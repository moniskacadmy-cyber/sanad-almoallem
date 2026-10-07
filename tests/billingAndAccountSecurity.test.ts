import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  BILLING_PLANS,
  verifyBillingHmacSignature,
  calculateExtendedSubscriptionDates,
  hashNormalizedEmail,
} from '../src/server/billing.js';

test('security: hashNormalizedEmail produces consistent sha256 across cases and whitespace', () => {
  const hash1 = hashNormalizedEmail('Teacher@Example.com');
  const hash2 = hashNormalizedEmail('  teacher@example.com  ');
  const hash3 = hashNormalizedEmail('TEACHER@EXAMPLE.COM');
  assert.equal(hash1, hash2);
  assert.equal(hash2, hash3);
  assert.equal(hash1.length, 64);
});

test('security: verifyBillingHmacSignature rejects invalid and tampered signatures', () => {
  const secret = 'webhook_secret_key_12345';
  const payload = JSON.stringify({ event: 'charge.success', uid: 'user_123', planId: 'monthly' });
  const validHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Valid signature
  assert.equal(verifyBillingHmacSignature(payload, validHmac, secret), true);
  assert.equal(verifyBillingHmacSignature(payload, `sha256=${validHmac}`, secret), true);

  // Wrong secret
  assert.equal(verifyBillingHmacSignature(payload, validHmac, 'wrong_secret'), false);

  // Tampered payload
  const tamperedPayload = JSON.stringify({ event: 'charge.success', uid: 'user_123', planId: 'yearly' });
  assert.equal(verifyBillingHmacSignature(tamperedPayload, validHmac, secret), false);

  // Missing or empty signature
  assert.equal(verifyBillingHmacSignature(payload, '', secret), false);
  assert.equal(verifyBillingHmacSignature(payload, undefined, secret), false);
});

test('billing: calculateExtendedSubscriptionDates extends from max(now, currentEndDate)', () => {
  const now = new Date('2026-10-06T00:00:00.000Z');

  // Case 1: Expired subscription (5 days ago) -> Extends from now
  const pastDate = new Date('2026-10-01T00:00:00.000Z');
  const ext1 = calculateExtendedSubscriptionDates(pastDate, 30, now);
  assert.equal(ext1.startDate, now.toISOString());
  assert.equal(ext1.endDate, new Date('2026-11-05T00:00:00.000Z').toISOString());

  // Case 2: Active subscription with 10 days remaining in the future -> Extends from existing end date
  const futureDate = new Date('2026-10-16T00:00:00.000Z');
  const ext2 = calculateExtendedSubscriptionDates(futureDate, 30, now);
  assert.equal(ext2.startDate, futureDate.toISOString());
  assert.equal(ext2.endDate, new Date('2026-11-15T00:00:00.000Z').toISOString());

  // Case 3: No previous subscription (undefined) -> Extends from now
  const ext3 = calculateExtendedSubscriptionDates(undefined, 180, now);
  assert.equal(ext3.startDate, now.toISOString());
  assert.equal(new Date(ext3.endDate).getTime() - now.getTime(), 180 * 24 * 60 * 60 * 1000);
});

test('billing: server-side plans have fixed prices and durations', () => {
  assert.ok(BILLING_PLANS.monthly);
  assert.ok(BILLING_PLANS.six_months);
  assert.ok(BILLING_PLANS.yearly);

  assert.equal(BILLING_PLANS.monthly.days, 30);
  assert.equal(BILLING_PLANS.six_months.days, 180);
  assert.equal(BILLING_PLANS.yearly.days, 365);
});
