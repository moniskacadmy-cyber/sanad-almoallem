import { test } from 'node:test';
import assert from 'node:assert/strict';

interface MockSentReminderDoc {
  exists: boolean;
  data: () => any;
}

function evaluateClaimTransaction(
  existingDoc: MockSentReminderDoc,
  nowMs: number = Date.now()
): { shouldSend: boolean; action: 'create' | 'update_stale' | 'update_failed' | 'skip_sent' | 'skip_active_claiming' } {
  const nowIso = new Date(nowMs).toISOString();

  if (!existingDoc.exists) {
    return { shouldSend: true, action: 'create' };
  }

  const currentData = existingDoc.data();
  if (currentData?.status === 'sent') {
    return { shouldSend: false, action: 'skip_sent' };
  }

  if (currentData?.status === 'claiming') {
    const claimedAtMs = currentData.claimedAt ? new Date(currentData.claimedAt).getTime() : 0;
    const isStale = nowMs - claimedAtMs > 2 * 60 * 1000;
    if (isStale) {
      return { shouldSend: true, action: 'update_stale' };
    }
    return { shouldSend: false, action: 'skip_active_claiming' };
  }

  if (currentData?.status === 'failed') {
    return { shouldSend: true, action: 'update_failed' };
  }

  return { shouldSend: false, action: 'skip_sent' };
}

test('cron claim: non-existent document allows claim and send', () => {
  const result = evaluateClaimTransaction({ exists: false, data: () => ({}) });
  assert.equal(result.shouldSend, true);
  assert.equal(result.action, 'create');
});

test('cron claim: already sent document blocks duplicate send', () => {
  const result = evaluateClaimTransaction({
    exists: true,
    data: () => ({ status: 'sent', sentAt: new Date().toISOString() }),
  });
  assert.equal(result.shouldSend, false);
  assert.equal(result.action, 'skip_sent');
});

test('cron claim: active claiming (< 2 minutes ago) blocks concurrent runs', () => {
  const now = Date.now();
  const result = evaluateClaimTransaction(
    {
      exists: true,
      data: () => ({ status: 'claiming', claimedAt: new Date(now - 30_000).toISOString() }),
    },
    now
  );
  assert.equal(result.shouldSend, false);
  assert.equal(result.action, 'skip_active_claiming');
});

test('cron claim: stale claiming (> 2 minutes ago) recovers and retries atomically', () => {
  const now = Date.now();
  const result = evaluateClaimTransaction(
    {
      exists: true,
      data: () => ({ status: 'claiming', claimedAt: new Date(now - 3 * 60 * 1000).toISOString() }),
    },
    now
  );
  assert.equal(result.shouldSend, true);
  assert.equal(result.action, 'update_stale');
});

test('cron claim: failed document allows retry', () => {
  const now = Date.now();
  const result = evaluateClaimTransaction(
    {
      exists: true,
      data: () => ({ status: 'failed', failedAt: new Date(now - 10_000).toISOString() }),
    },
    now
  );
  assert.equal(result.shouldSend, true);
  assert.equal(result.action, 'update_failed');
});
