import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLocalUpcomingSchedules,
  checkTestReminderQuota,
  incrementTestReminderQuota,
} from '../src/services/reminderService.js';
import { ScheduleSlot, Student } from '../src/types.js';

// Polyfill localStorage for node test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

test('local schedule evaluation: matches slots within lookahead window in memory without API calls', () => {
  // Current time: 15:45 (dayOfWeek = 3 / Wednesday)
  const now = new Date(2026, 9, 7, 15, 45, 0); // 15:45 local

  const schedules: ScheduleSlot[] = [
    {
      id: 'slot_1600',
      teacherId: 't1',
      studentId: 's1',
      studentName: 'أحمد',
      dayOfWeek: now.getDay(),
      time: '16:00', // Starts in 15 minutes -> MATCH
      duration: 60,
      recurrence: 'weekly',
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'slot_1700',
      teacherId: 't1',
      studentId: 's2',
      studentName: 'سارة',
      dayOfWeek: now.getDay(),
      time: '17:00', // Starts in 75 minutes -> SKIP
      duration: 60,
      recurrence: 'weekly',
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'slot_diff_day',
      teacherId: 't1',
      studentId: 's3',
      studentName: 'محمود',
      dayOfWeek: (now.getDay() + 1) % 7,
      time: '16:00', // Different day -> SKIP
      duration: 60,
      recurrence: 'weekly',
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    },
  ];

  const students: Student[] = [
    {
      id: 's1',
      teacherId: 't1',
      name: 'أحمد',
      whatsapp: '01012345678',
      subject: 'رياضيات',
      classType: 'online',
      hourlyRate: 100,
      createdAt: null,
      updatedAt: null,
    },
  ];

  const result = checkLocalUpcomingSchedules({
    schedules,
    students,
    minutesBefore: 15,
    now,
    alertedSlots: new Set(),
  });

  assert.equal(result.dueReminders.length, 1);
  assert.equal(result.dueReminders[0].slotId, 'slot_1600');
  assert.equal(result.dueReminders[0].studentName, 'أحمد');
  assert.equal(result.dueReminders[0].classTime, '16:00');
  assert.equal(result.dueReminders[0].subject, 'رياضيات');
});

test('local schedule evaluation: skips already alerted slots (no duplicate alerts)', () => {
  const now = new Date(2026, 9, 7, 15, 45, 0);
  const todayStr = now.toISOString().slice(0, 10);
  const slotKey = `slot_1600_${todayStr}_16:00`;

  const schedules: ScheduleSlot[] = [
    {
      id: 'slot_1600',
      teacherId: 't1',
      studentId: 's1',
      studentName: 'أحمد',
      dayOfWeek: now.getDay(),
      time: '16:00',
      duration: 60,
      recurrence: 'weekly',
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    },
  ];

  // Pass already alerted slotKey
  const alertedSlots = new Set<string>([slotKey]);
  const result = checkLocalUpcomingSchedules({
    schedules,
    students: [],
    minutesBefore: 15,
    now,
    alertedSlots,
  });

  assert.equal(result.dueReminders.length, 0, 'Must not re-alert an already alerted slot');
});

test('test reminder daily rate limit: allows max 3 per day and enforces quota', () => {
  localStorage.clear();

  const quota1 = checkTestReminderQuota();
  assert.equal(quota1.allowed, true);
  assert.equal(quota1.remaining, 3);

  incrementTestReminderQuota();
  const quota2 = checkTestReminderQuota();
  assert.equal(quota2.allowed, true);
  assert.equal(quota2.remaining, 2);

  incrementTestReminderQuota();
  incrementTestReminderQuota();
  const quota3 = checkTestReminderQuota();
  assert.equal(quota3.allowed, false);
  assert.equal(quota3.remaining, 0);
});

test('recurrence in memory: handles daily and once recurrence correctly', () => {
  const now = new Date(2026, 9, 7, 13, 50, 0); // 13:50
  const todayDateStr = now.toISOString().slice(0, 10);

  const schedules: ScheduleSlot[] = [
    {
      id: 'daily_slot',
      teacherId: 't1',
      studentId: 's_daily',
      studentName: 'طالب يومي',
      dayOfWeek: 0, // Ignored for daily
      time: '14:00', // Starts in 10 minutes -> MATCH
      duration: 60,
      recurrence: 'daily',
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'once_slot_today',
      teacherId: 't1',
      studentId: 's_once',
      studentName: 'طالب حصة واحدة',
      dayOfWeek: 0,
      time: '14:00',
      duration: 60,
      recurrence: 'once',
      date: todayDateStr, // MATCH
      classType: 'online',
      createdAt: null,
      updatedAt: null,
    } as any,
  ];

  const result = checkLocalUpcomingSchedules({
    schedules,
    students: [],
    minutesBefore: 15,
    now,
    alertedSlots: new Set(),
  });

  assert.equal(result.dueReminders.length, 2);
  assert.equal(result.dueReminders[0].slotId, 'daily_slot');
  assert.equal(result.dueReminders[1].slotId, 'once_slot_today');
});
