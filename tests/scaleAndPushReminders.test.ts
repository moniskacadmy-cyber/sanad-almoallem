import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timingSafeCompareSecret,
  chunkFcmTokens,
  buildMobilePushPayload,
  runConcurrentPool,
  shouldBypassWhatsAppInCron,
} from '../server.js';

test('security: timingSafeCompareSecret uses timing-safe buffer comparison', () => {
  const secret = 'my-super-secret-cron-token-12345';
  assert.equal(timingSafeCompareSecret(secret, secret), true);
  assert.equal(timingSafeCompareSecret('wrong-secret', secret), false);
  assert.equal(timingSafeCompareSecret('', secret), false);
  assert.equal(timingSafeCompareSecret(secret, ''), false);
  assert.equal(timingSafeCompareSecret(secret + 'a', secret), false);
});

test('scalability: chunkFcmTokens splits large token arrays into chunks <= 500 (FCM limit)', () => {
  // Test 1: Empty and small
  assert.deepEqual(chunkFcmTokens([]), []);
  assert.deepEqual(chunkFcmTokens(['token1', 'token2']), [['token1', 'token2']]);

  // Test 2: Exactly 500
  const tokens500 = Array.from({ length: 500 }, (_, i) => `token_${i}`);
  const chunks500 = chunkFcmTokens(tokens500);
  assert.equal(chunks500.length, 1);
  assert.equal(chunks500[0].length, 500);

  // Test 3: 1250 tokens (over FCM multicast limit) -> splits into 500 + 500 + 250
  const tokens1250 = Array.from({ length: 1250 }, (_, i) => `token_${i}`);
  const chunks1250 = chunkFcmTokens(tokens1250);
  assert.equal(chunks1250.length, 3);
  assert.equal(chunks1250[0].length, 500);
  assert.equal(chunks1250[1].length, 500);
  assert.equal(chunks1250[2].length, 250);
  // Invariant: no chunk ever exceeds 500
  assert.ok(chunks1250.every((c) => c.length <= 500));
});

test('mobile push: buildMobilePushPayload ensures high delivery priority and mobile interaction', () => {
  const payload = buildMobilePushPayload({
    tokens: ['device_token_abc'],
    title: '⏰ تذكير موعد الحصة القادمة',
    body: 'أستاذ أحمد، لديك حصة قادمة مع الطالب (عمر) في تمام الساعة 14:00.',
    scheduleId: 'sched_123',
    studentName: 'عمر',
    time: '14:00',
    tag: 'class-reminder',
  });

  // Verify FCM tokens
  assert.deepEqual(payload.tokens, ['device_token_abc']);

  // Verify webpush headers for waking mobile devices
  assert.equal(payload.webpush?.headers?.Urgency, 'high');
  assert.equal(payload.webpush?.headers?.TTL, '3600');

  // Verify webpush notification fields for mobile display
  assert.equal(payload.webpush?.notification?.tag, 'class-reminder');
  assert.equal(payload.webpush?.notification?.renotify, true);
  assert.equal(payload.webpush?.notification?.requireInteraction, true);
  assert.deepEqual(payload.webpush?.notification?.vibrate, [200, 100, 200]);

  // Verify Android high priority configuration
  assert.equal(payload.android?.priority, 'high');
  assert.equal(payload.android?.notification?.priority, 'high');
  assert.equal(payload.android?.notification?.channelId, 'lesson-reminders');
});

test('performance & scale: runConcurrentPool processes tasks in parallel bounded batches', async () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  let activeConcurrency = 0;
  let maxObservedConcurrency = 0;

  const results = await runConcurrentPool(items, 5, async (item) => {
    activeConcurrency++;
    if (activeConcurrency > maxObservedConcurrency) {
      maxObservedConcurrency = activeConcurrency;
    }
    // Simulate brief asynchronous work
    await new Promise((res) => setTimeout(res, 10));
    activeConcurrency--;
    return item * 2;
  });

  // All 25 items processed correctly
  assert.equal(results.length, 25);
  assert.deepEqual(results, items.map((i) => i * 2));
  // Concurrency was actually parallel (more than 1) but bounded (never more than limit 5)
  assert.ok(maxObservedConcurrency > 1, 'Should process items in parallel');
  assert.ok(maxObservedConcurrency <= 5, 'Should never exceed concurrency limit');
});

test('optimization: shouldBypassWhatsAppInCron respects configuration and skips external delays', () => {
  // By default, WhatsApp is bypassed in cron per product requirements (WhatsApp not needed)
  assert.equal(shouldBypassWhatsAppInCron({}), true);
  assert.equal(shouldBypassWhatsAppInCron({ WHATSAPP_ENABLED: 'false' }), true);
  assert.equal(shouldBypassWhatsAppInCron({ WHATSAPP_SEND_TO_TEACHER: 'false' }), true);
  // Only explicitly enabled if set to 'true'
  assert.equal(shouldBypassWhatsAppInCron({ WHATSAPP_ENABLED: 'true', WHATSAPP_SEND_TO_TEACHER: 'true' }), false);
});
