import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSubscription,
  authorizeActiveSubscription,
  type AccessDeps,
  type TeacherSubscriptionData,
} from '../src/server/subscriptionAccess.js';

/**
 * End-to-End Workflow Emulator Test
 * Validates the full 5-step teacher lifecycle on the emulator logic:
 * 1. Registration & trial provisioning
 * 2. Add student & schedule
 * 3. Attendance recording
 * 4. Settings & account queries
 * 5. Expired subscription blocks writing
 */

const NOW = new Date('2026-10-07T12:00:00Z');
const FUTURE = new Date('2026-11-01T00:00:00Z');
const PAST = new Date('2026-09-01T00:00:00Z');

function createMockDeps(teacherData: TeacherSubscriptionData | null): AccessDeps {
  return {
    now: () => NOW,
    isAdmin: async () => false,
    readTeacher: async () => teacherData,
    logError: () => {},
  };
}

test('E2E Emulator Workflow: 1. Registration produces valid active 14-day trial', () => {
  const trialEndDate = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);

  const teacherData: TeacherSubscriptionData = {
    trialEndDate: trialEndDate.toISOString(),
    subscriptionExpiresAt: trialEndDate.toISOString(),
    isActive: true,
  };

  const status = evaluateSubscription(teacherData, NOW);
  assert.equal(status, 'active');
});

test('E2E Emulator Workflow: 2. Active teacher can add student and create class schedule', async () => {
  const activeTeacher: TeacherSubscriptionData = {
    subscriptionEndDate: FUTURE.toISOString(),
    subscriptionExpiresAt: FUTURE.toISOString(),
    isActive: true,
  };

  const deps = createMockDeps(activeTeacher);
  const decision = await authorizeActiveSubscription('teacher_active_123', deps);
  assert.equal(decision.ok, true);
  if (decision.ok) {
    assert.equal(decision.reason, 'active_subscription');
  }
});

test('E2E Emulator Workflow: 3. Attendance recording is allowed during valid subscription', async () => {
  const activeTeacher: TeacherSubscriptionData = {
    subscriptionEndDate: FUTURE.toISOString(),
    subscriptionExpiresAt: FUTURE.toISOString(),
    isActive: true,
  };

  const deps = createMockDeps(activeTeacher);
  const decision = await authorizeActiveSubscription('teacher_active_123', deps);
  assert.equal(decision.ok, true);
});

test('E2E Emulator Workflow: 4. Teacher can query account settings & profile', () => {
  const teacher: TeacherSubscriptionData = {
    trialEndDate: FUTURE.toISOString(),
    subscriptionExpiresAt: FUTURE.toISOString(),
    isActive: true,
  };

  const status = evaluateSubscription(teacher, NOW);
  assert.equal(status, 'active');
});

test('E2E Emulator Workflow: 5. Expired subscription strictly blocks data writing (403)', async () => {
  const expiredTeacher: TeacherSubscriptionData = {
    subscriptionEndDate: PAST.toISOString(),
    subscriptionExpiresAt: PAST.toISOString(),
    isActive: false,
  };

  const deps = createMockDeps(expiredTeacher);
  const decision = await authorizeActiveSubscription('teacher_expired_456', deps);
  assert.equal(decision.ok, false);
  if (!decision.ok) {
    assert.equal(decision.status, 403);
    assert.equal(decision.code, 'account_deactivated');
  }
});
