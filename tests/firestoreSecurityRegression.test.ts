import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

test('security regression: teacher creation uses an explicit field allowlist', () => {
  assert.match(rules, /data\.keys\(\)\.hasOnly\(\[/);
  assert.match(rules, /'subscriptionEndDate'/);
  assert.match(rules, /'subscriptionExpiresAt'/);
});

test('security regression: trial creation cannot forge a longer subscriptionEndDate', () => {
  assert.match(
    rules,
    /data\.subscriptionExpiresAt == data\.trialEndDate\s*&&\s*data\.subscriptionEndDate == data\.trialEndDate/
  );
});

test('security regression: active writes require isActive and an unexpired subscription', () => {
  assert.match(rules, /data\.isActive != false/);
  assert.match(rules, /data\.subscriptionExpiresAt > request\.time/);
});

test('security regression: pre-provisioned active subscriptions must match the admin record and require verified email', () => {
  assert.match(rules, /hasPreprovisionedSubscription/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /data\.subscriptionEndDate == get\(/);
  assert.match(rules, /data\.plan == get\(/);
});

test('security regression: teacher profile update allowlist includes reminder settings and timezone', () => {
  assert.match(rules, /'remindersEnabled'/);
  assert.match(rules, /'reminderMinutesBefore'/);
  assert.match(rules, /'teacherNotificationsEnabled'/);
  assert.match(rules, /'timezone'/);
  assert.match(rules, /data\.reminderMinutesBefore >= 5 && data\.reminderMinutesBefore <= 120/);
});

test('security regression: task update allows preserving existing createdAt', () => {
  assert.match(rules, /isValidTaskUpdate/);
  assert.match(rules, /data\.createdAt == existing\(\)\.createdAt \|\| data\.createdAt == request\.time/);
});
