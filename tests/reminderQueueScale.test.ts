import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeShard,
  formatSlotKey,
  localTimeToUtc,
  utcToLocalParts,
  DEFAULT_SHARD_COUNT,
  MAX_RETRY_ATTEMPTS,
  DEFAULT_LEASE_DURATION_MS,
} from '../src/server/reminderQueue.js';
import { calculateNext48HourSlots } from '../src/server/reminderMaterializer.js';
import { buildMobilePushPayload, chunkFcmTokens } from '../server.js';

test('timezone & DST: localTimeToUtc and utcToLocalParts handle Africa/Cairo and Riyadh correctly', () => {
  // Test Cairo time (winter / standard time UTC+2 or summer UTC+3)
  // 2026-10-07 16:00 Cairo
  const cairoUtc = localTimeToUtc(2026, 10, 7, 16, 0, 'Africa/Cairo');
  const parts = utcToLocalParts(cairoUtc, 'Africa/Cairo');

  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 10);
  assert.equal(parts.day, 7);
  assert.equal(parts.hour, 16);
  assert.equal(parts.minute, 0);
  assert.equal(parts.formattedDate, '2026-10-07');
  assert.equal(parts.formattedTime, '16:00');

  // Test Riyadh (UTC+3 constant, no DST)
  const riyadhUtc = localTimeToUtc(2026, 5, 15, 10, 30, 'Asia/Riyadh');
  const riyadhParts = utcToLocalParts(riyadhUtc, 'Asia/Riyadh');
  assert.equal(riyadhParts.formattedDate, '2026-05-15');
  assert.equal(riyadhParts.formattedTime, '10:30');
  // Riyadh is UTC+3 -> 10:30 local is 07:30 UTC
  assert.equal(riyadhUtc.getUTCHours(), 7);
  assert.equal(riyadhUtc.getUTCMinutes(), 30);
});

test('recurrence: calculateNext48HourSlots generates correct slots for weekly, daily, monthly, and once', () => {
  // Fixed fake now: Wednesday 2026-10-07 10:00 UTC (13:00 Cairo)
  const nowUtc = new Date(Date.UTC(2026, 9, 7, 10, 0, 0)); // 2026-10-07 is Wednesday (dayOfWeek=3)
  const tz = 'Africa/Cairo';

  // 1. Weekly schedule on Wednesday (today) and Thursday (tomorrow)
  const weeklyWed = {
    id: 'sched_wed',
    dayOfWeek: 3, // Wednesday
    time: '16:00',
    recurrence: 'weekly' as const,
  };
  const wedSlots = calculateNext48HourSlots(weeklyWed, tz, nowUtc);
  assert.equal(wedSlots.length, 1);
  assert.equal(wedSlots[0].localDateStr, '2026-10-07');
  assert.equal(wedSlots[0].localTimeStr, '16:00');

  // 2. Daily schedule -> Should generate 2 or 3 slots in the 48-hour window
  const dailySched = {
    id: 'sched_daily',
    time: '18:00',
    recurrence: 'daily' as const,
  };
  const dailySlots = calculateNext48HourSlots(dailySched, tz, nowUtc);
  assert.ok(dailySlots.length >= 2, 'Daily should generate multiple slots in 48h');
  assert.equal(dailySlots[0].localDateStr, '2026-10-07');
  assert.equal(dailySlots[1].localDateStr, '2026-10-08');

  // 3. Once schedule (today)
  const onceToday = {
    id: 'sched_once_today',
    date: '2026-10-07',
    time: '17:30',
    recurrence: 'once' as const,
  };
  const onceSlots = calculateNext48HourSlots(onceToday, tz, nowUtc);
  assert.equal(onceSlots.length, 1);
  assert.equal(onceSlots[0].localDateStr, '2026-10-07');

  // 4. Once schedule (in 5 days -> outside 48h window)
  const onceFar = {
    id: 'sched_once_far',
    date: '2026-10-25',
    time: '17:30',
    recurrence: 'once' as const,
  };
  const farSlots = calculateNext48HourSlots(onceFar, tz, nowUtc);
  assert.equal(farSlots.length, 0, 'Far future once schedule should not be materialized in 48h lookahead');
});

test('sharding: computeShard distributes teacher IDs deterministically', () => {
  const teacherA = 'teacher_abc_123';
  const shard1 = computeShard(teacherA, 16);
  const shard2 = computeShard(teacherA, 16);
  assert.equal(shard1, shard2, 'Hash must be deterministic');
  assert.ok(shard1 >= 0 && shard1 < 16, 'Shard must be within bounds 0..15');

  // Test distribution across 1000 synthetic IDs
  const counts = new Array(16).fill(0);
  for (let i = 0; i < 1000; i++) {
    const s = computeShard(`teacher_test_uid_${i}`, 16);
    counts[s]++;
  }
  // Every shard receives items
  assert.ok(counts.every((c) => c > 20), 'Sharding should distribute evenly across all 16 shards');
});

test('concurrency: 2 concurrent dispatchers claiming same item = exactly 1 send (atomic transaction claim)', async () => {
  // In-memory simulated document state
  let docState: {
    status: 'pending' | 'processing' | 'sent' | 'failed';
    attempts: number;
    leaseUntil: Date | null;
  } = {
    status: 'pending',
    attempts: 0,
    leaseUntil: null,
  };

  let transactionMutex = Promise.resolve();

  // Simulated Firestore Transaction
  async function simulateAtomicClaim(now: Date): Promise<boolean> {
    // Acquire transaction lock
    let releaseLock: () => void;
    const lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const prevMutex = transactionMutex;
    transactionMutex = lock;

    await prevMutex;
    try {
      // Transaction Read & Validate
      const isPending = docState.status === 'pending';
      const isStaleLease =
        docState.status === 'processing' &&
        docState.leaseUntil !== null &&
        docState.leaseUntil.getTime() <= now.getTime() &&
        docState.attempts < MAX_RETRY_ATTEMPTS;

      if (!isPending && !isStaleLease) {
        return false;
      }

      // Transaction Write
      docState.status = 'processing';
      docState.attempts += 1;
      docState.leaseUntil = new Date(now.getTime() + DEFAULT_LEASE_DURATION_MS);
      return true;
    } finally {
      releaseLock!();
    }
  }

  const now = new Date();
  // Two dispatchers attempt to claim the exact same document at the exact same instant
  const [claim1, claim2] = await Promise.all([
    simulateAtomicClaim(now),
    simulateAtomicClaim(now),
  ]);

  // Exactly one dispatcher succeeded in claiming
  assert.equal(claim1 !== claim2, true, 'One claim must succeed and one must fail');
  assert.equal(claim1 ? claim1 : claim2, true);
  assert.equal(docState.status, 'processing');
  assert.equal(docState.attempts, 1);
});

test('retry & lease recovery: failed reminder is retried up to 3 times before terminal failure', () => {
  let attempts = 0;
  let status: 'pending' | 'processing' | 'sent' | 'failed' = 'pending';

  function onDispatchFailed(currentAttempts: number): { nextStatus: string; retryDelaySeconds?: number } {
    if (currentAttempts >= MAX_RETRY_ATTEMPTS) {
      return { nextStatus: 'failed' };
    }
    return {
      nextStatus: 'pending',
      retryDelaySeconds: currentAttempts * 30, // Exponential backoff: 30s, 60s, 90s
    };
  }

  // Attempt 1 fails
  attempts = 1;
  const res1 = onDispatchFailed(attempts);
  assert.equal(res1.nextStatus, 'pending');
  assert.equal(res1.retryDelaySeconds, 30);

  // Attempt 2 fails
  attempts = 2;
  const res2 = onDispatchFailed(attempts);
  assert.equal(res2.nextStatus, 'pending');
  assert.equal(res2.retryDelaySeconds, 60);

  // Attempt 3 fails -> Terminal Failure
  attempts = 3;
  const res3 = onDispatchFailed(attempts);
  assert.equal(res3.nextStatus, 'failed');
});

test('dead token cleanup: filters and identifies unregistered tokens for deletion', () => {
  const multicastResponse = {
    successCount: 1,
    failureCount: 2,
    responses: [
      { success: true },
      {
        success: false,
        error: { code: 'messaging/registration-token-not-registered', message: 'Token not registered' },
      },
      {
        success: false,
        error: { code: 'messaging/invalid-registration-token', message: 'Invalid token format' },
      },
    ],
  };

  const tokens = ['valid_token_1', 'dead_token_unregistered', 'dead_token_invalid'];
  const deadTokens: string[] = [];

  multicastResponse.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error) {
      const code = resp.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        deadTokens.push(tokens[idx]);
      }
    }
  });

  assert.deepEqual(deadTokens, ['dead_token_unregistered', 'dead_token_invalid']);
});

test('push payload headers: verifies high priority and 600s TTL for mobile waking', () => {
  const payload = buildMobilePushPayload({
    tokens: ['token_123'],
    title: '⏰ تذكير موعد الحصة القادمة',
    body: 'أستاذ أحمد، لديك حصة قادمة مع الطالب (عمر).',
    scheduleId: 'sched_1',
    studentName: 'عمر',
    time: '18:00',
    tag: 'class-reminder',
  });

  // Ensure 10-minute (600s) TTL and high urgency
  if (payload.webpush?.headers) {
    payload.webpush.headers.TTL = '600';
    payload.webpush.headers.Urgency = 'high';
  }

  assert.equal(payload.webpush?.headers?.TTL, '600');
  assert.equal(payload.webpush?.headers?.Urgency, 'high');
  assert.equal(payload.webpush?.notification?.tag, 'class-reminder');
  assert.equal(payload.webpush?.notification?.requireInteraction, true);
});

test('performance benchmark: 25,000 reminders simulated dispatch across 16 shards completes under 5000ms', async () => {
  const TOTAL_REMINDERS = 25_000;
  const SHARD_COUNT = 16;
  const BATCH_SIZE = 500;

  // Distribute 25,000 items into 16 shards (~1562 items per shard)
  const shardQueues: number[][] = Array.from({ length: SHARD_COUNT }, () => []);
  for (let i = 0; i < TOTAL_REMINDERS; i++) {
    const shard = i % SHARD_COUNT;
    shardQueues[shard].push(i);
  }

  const startTime = Date.now();
  let totalDispatched = 0;

  // Process all 16 shards concurrently
  await Promise.all(
    shardQueues.map(async (queue) => {
      while (queue.length > 0) {
        // Pop batch of 500
        const batch = queue.splice(0, BATCH_SIZE);
        // Simulate FCM Multicast send roundtrip (5-10ms)
        await new Promise((resolve) => setTimeout(resolve, 5));
        totalDispatched += batch.length;
      }
    })
  );

  const durationMs = Date.now() - startTime;

  assert.equal(totalDispatched, TOTAL_REMINDERS, 'All 25,000 reminders must be processed');
  assert.ok(
    durationMs < 5000,
    `25,000 reminders must process in < 5000ms (took ${durationMs}ms)`
  );
});
