import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  normalizeTime,
  getGroupAgenda,
  getIndividualAgenda,
  sortAgenda,
  dueForReminder,
  isInMorningWindow,
  isMutedByDnd,
  formatTimeArabic,
  countLabel,
  buildClassReminderMessage,
  buildAgendaMessage,
} from '../src/server/agenda';

test('timeToMinutes / normalizeTime accept H:MM and HH:MM, reject garbage', () => {
  assert.equal(timeToMinutes('07:05'), 425);
  assert.equal(timeToMinutes('7:05'), 425);
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('24:00'), null);
  assert.equal(timeToMinutes('12:60'), null);
  assert.equal(timeToMinutes('7:5'), null);
  assert.equal(timeToMinutes(''), null);
  assert.equal(timeToMinutes(undefined), null);
  assert.equal(timeToMinutes(1700), null);
  assert.equal(normalizeTime('7:05'), '07:05');
  assert.equal(normalizeTime('x'), null);
});

const groups = [
  { id: 'a', name: 'الصف الثالث', centerName: 'سنتر النور', subject: 'رياضيات', status: 'active', schedule: [{ day: 6, time: '17:00' }, { day: 2, time: '5:30' }] },
  { id: 'b', name: 'موقوفة', status: 'paused', schedule: [{ day: 6, time: '10:00' }] },
  { id: 'c', name: 'مؤرشفة', status: 'active', archived: true, schedule: [{ day: 6, time: '11:00' }] },
  { id: 'd', name: 'غير نشطة', active: false, schedule: [{ day: 6, time: '12:00' }] },
  { id: 'e', name: 'ميعاد مكرر وخاطئ', schedule: [{ day: 6, time: '09:00' }, { day: 6, time: '9:00' }, { day: 6, time: 'bad' }, { day: '6', time: '18:00' }] },
];

test('group agenda: only active groups that meet today, de-duplicated, invalid times dropped', () => {
  const sat = getGroupAgenda(groups, 6);
  assert.deepEqual(
    sat.map((i) => `${i.id}|${i.time}`).sort(),
    ['g_a_6_1700|17:00', 'g_e_6_0900|09:00', 'g_e_6_1800|18:00'].sort()
  );
  const tue = getGroupAgenda(groups, 2);
  assert.equal(tue.length, 1);
  assert.equal(tue[0].time, '05:30');
  assert.equal(tue[0].place, 'سنتر النور');
  assert.equal(getGroupAgenda(groups, 0).length, 0);
  assert.equal(getGroupAgenda(undefined as any, 0).length, 0);
});

test('individual agenda: wrong day, bad time and already-completed-today slots are skipped', () => {
  const slots = [
    { id: '1', dayOfWeek: 6, time: '16:00', studentName: 'أحمد' },
    { id: '2', dayOfWeek: 5, time: '16:00', studentName: 'غير اليوم' },
    { id: '3', dayOfWeek: 6, time: '', studentName: 'بلا وقت' },
    { id: '4', dayOfWeek: 6, time: '18:00', studentName: 'تمت', completedTodayDate: '2026-10-24' },
    { id: '5', dayOfWeek: 6, time: '19:00', studentName: 'قديمة', completedTodayDate: '2026-10-17' },
  ];
  const items = getIndividualAgenda(slots, 6, '2026-10-24');
  assert.deepEqual(items.map((i) => i.id), ['1', '5']);
});

test('dueForReminder: strictly in the future and within the lead window', () => {
  const items = [
    { id: 'x', kind: 'group' as const, time: '17:00', minutes: 1020, title: 'g' },
  ];
  assert.equal(dueForReminder(items, 1020 - 16, 15).length, 0); // 16 min before
  assert.equal(dueForReminder(items, 1020 - 15, 15).length, 1); // exactly 15 before
  assert.equal(dueForReminder(items, 1020 - 1, 15).length, 1);
  assert.equal(dueForReminder(items, 1020, 15).length, 0); // already started
  assert.equal(dueForReminder(items, 1020 + 5, 15).length, 0);
  assert.equal(dueForReminder(items, 1020 - 10, 0).length, 1); // invalid lead falls back to 15
});

test('morning window: from the chosen time, for 2 hours, never past midnight', () => {
  const seven = 7 * 60;
  assert.equal(isInMorningWindow(seven - 1, seven), false);
  assert.equal(isInMorningWindow(seven, seven), true);
  assert.equal(isInMorningWindow(seven + 119, seven), true);
  assert.equal(isInMorningWindow(seven + 120, seven), false);
  assert.equal(isInMorningWindow(23 * 60 + 59, 23 * 60 + 30), true);
  assert.equal(isInMorningWindow(0, 23 * 60 + 30), false);
});

test('DND: disabled, overnight range, boundaries, weekends, vacation, equal times', () => {
  assert.equal(isMutedByDnd(undefined, 1, 600), false);
  assert.equal(isMutedByDnd({ enabled: false, startTime: '22:00', endTime: '07:00' }, 1, 23 * 60), false);
  const dnd = { enabled: true, startTime: '22:00', endTime: '07:00' };
  assert.equal(isMutedByDnd(dnd, 1, 23 * 60), true);
  assert.equal(isMutedByDnd(dnd, 1, 3 * 60), true);
  assert.equal(isMutedByDnd(dnd, 1, 7 * 60), false); // 07:00 is NOT muted: the morning summary can go out
  assert.equal(isMutedByDnd(dnd, 1, 6 * 60 + 59), true);
  assert.equal(isMutedByDnd(dnd, 1, 12 * 60), false);
  assert.equal(isMutedByDnd({ enabled: true, startTime: '13:00', endTime: '15:00' }, 1, 14 * 60), true);
  assert.equal(isMutedByDnd({ enabled: true, startTime: '13:00', endTime: '15:00' }, 1, 15 * 60), false);
  assert.equal(isMutedByDnd({ enabled: true, startTime: '08:00', endTime: '08:00' }, 1, 8 * 60), false);
  assert.equal(isMutedByDnd({ enabled: true, muteWeekends: true }, 5, 600), true); // Friday
  assert.equal(isMutedByDnd({ enabled: true, muteWeekends: true }, 6, 600), true); // Saturday
  assert.equal(isMutedByDnd({ enabled: true, muteWeekends: true }, 0, 600), false);
  assert.equal(isMutedByDnd({ enabled: true, vacationMode: true }, 2, 600), true);
});

test('Arabic time & count formatting', () => {
  assert.equal(formatTimeArabic('00:00'), '12:00 ص');
  assert.equal(formatTimeArabic('09:30'), '9:30 ص');
  assert.equal(formatTimeArabic('12:00'), '12:00 م');
  assert.equal(formatTimeArabic('17:05'), '5:05 م');
  assert.equal(countLabel(1), 'حصة واحدة');
  assert.equal(countLabel(2), 'حصتين');
  assert.equal(countLabel(5), '5 حصص');
  assert.equal(countLabel(11), '11 حصة');
});

test('class reminder text: group vs individual', () => {
  const g = buildClassReminderMessage('منى', { id: 'g', kind: 'group', time: '17:00', minutes: 1020, title: 'الصف الثالث', place: 'سنتر النور' });
  assert.match(g.body, /مجموعة الصف الثالث \(سنتر النور\)/);
  assert.match(g.body, /5:00 م/);
  const i = buildClassReminderMessage(undefined, { id: 'i', kind: 'individual', time: '09:00', minutes: 540, title: 'أحمد' });
  assert.match(i.body, /المعلم/);
  assert.match(i.body, /\(أحمد\)/);
});

test('morning summary: silent without classes, lists up to 4 sorted, counts the rest', () => {
  assert.equal(buildAgendaMessage({ mode: 'morning', items: [] }), null);
  const mk = (n: number) => ({ id: `i${n}`, kind: 'individual' as const, time: `${String(8 + n).padStart(2, '0')}:00`, minutes: (8 + n) * 60, title: `طالب${n}` });
  const msg = buildAgendaMessage({ mode: 'morning', teacherName: 'منى', items: [mk(5), mk(1), mk(3), mk(2), mk(4), mk(0)] })!;
  assert.match(msg.title, /منى/);
  assert.match(msg.body, /^عندك 6 حصص النهاردة: 8:00 ص طالب0، 9:00 ص طالب1، 10:00 ص طالب2، 11:00 ص طالب3 و2 أخرى\.$/);
  assert.equal(msg.tag, 'morning-summary');
  assert.deepEqual(sortAgenda([mk(2), mk(1)]).map((x) => x.id), ['i1', 'i2']);
});

test('login summary: always produces a message, with or without classes', () => {
  const empty = buildAgendaMessage({ mode: 'login', teacherName: 'منى', items: [] })!;
  assert.match(empty.body, /مفيش حصص/);
  const one = buildAgendaMessage({
    mode: 'login',
    items: [{ id: 'g', kind: 'group', time: '17:00', minutes: 1020, title: 'ثالث', place: 'النور' }],
  })!;
  assert.match(one.body, /حصة واحدة النهاردة: 5:00 م مجموعة ثالث \(النور\)\./);
  assert.equal(one.tag, 'login-summary');
});
