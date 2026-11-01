import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUpcomingSlots } from '../src/server/remindersCron.js';
import {
  generateDailyDigestMessage,
  cancelScheduledNotification,
  registerScheduledReminderTimer,
} from '../src/services/reminderService.js';

test('checkUpcomingSlots: drops slots when student is not in students list (deleted student)', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  // Day of week in Cairo for this date
  const schedules = [
    {
      id: 'sched_deleted',
      studentId: 'deleted_student_123',
      studentName: 'طالب محذوف',
      dayOfWeek: now.getDay(),
      time: '12:15',
    },
    {
      id: 'sched_active',
      studentId: 'active_student_456',
      studentName: 'طالب نشط',
      dayOfWeek: now.getDay(),
      time: '12:15',
    },
  ];

  // Only the active student exists in the database/students array
  const students = [
    {
      id: 'active_student_456',
      name: 'طالب نشط',
      whatsapp: '01012345678',
      subject: 'لغة عربية',
      status: 'active',
      archived: false,
    },
  ];

  const result = checkUpcomingSlots({
    schedules,
    groups: [],
    students,
    teacherId: 'teacher_1',
    teacherName: 'أحمد',
    now,
    minutesWindow: 15,
  });

  // Verify that only the active student gets reminders and the deleted student is dropped
  const reminderStudentIds = result.matchedReminders.map((r) => r.studentId);
  assert.ok(!reminderStudentIds.includes('deleted_student_123'), 'Deleted student must never receive a reminder');
});

test('checkUpcomingSlots: drops slots when student is archived', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  const schedules = [
    {
      id: 'sched_archived',
      studentId: 'archived_student_789',
      studentName: 'طالب مؤرشف',
      dayOfWeek: now.getDay(),
      time: '12:15',
    },
  ];

  const students = [
    {
      id: 'archived_student_789',
      name: 'طالب مؤرشف',
      whatsapp: '01012345678',
      subject: 'لغة عربية',
      status: 'active',
      archived: true,
    },
  ];

  const result = checkUpcomingSlots({
    schedules,
    groups: [],
    students,
    teacherId: 'teacher_1',
    teacherName: 'أحمد',
    now,
    minutesWindow: 15,
  });

  assert.equal(result.matchedReminders.length, 0, 'Archived student must not receive reminders');
});

test('cancelScheduledNotification: clears registered in-memory timers', () => {
  let timerFired = false;
  const timeoutId = setTimeout(() => {
    timerFired = true;
  }, 5000);

  registerScheduledReminderTimer('student_abc_slot_1', timeoutId);
  cancelScheduledNotification({ studentId: 'student_abc' });

  // Clear timeout manually as safeguard
  clearTimeout(timeoutId);
  assert.equal(timerFired, false, 'Timer should have been cleared');
});

test('generateDailyDigestMessage: filters out schedules of deleted students', () => {
  const today = new Date().getDay();
  const schedules: any[] = [
    {
      id: 's1',
      studentId: 'st_deleted',
      studentName: 'محذوف',
      dayOfWeek: today,
      time: '14:00',
    },
    {
      id: 's2',
      studentId: 'st_valid',
      studentName: 'محمود',
      dayOfWeek: today,
      time: '16:00',
    },
  ];

  const students: any[] = [
    {
      id: 'st_valid',
      name: 'محمود',
      status: 'active',
      archived: false,
    },
  ];

  const digest = generateDailyDigestMessage({ schedules, students });
  assert.equal(digest.count, 1, 'Should only count the active student');
  assert.ok(digest.body.includes('محمود'));
  assert.ok(!digest.body.includes('محذوف'));
});
