import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stageSchedules,
  stageStudentWithSchedules,
  type NewStudentInput,
  type NewScheduleForStudent,
} from '../src/services/studentSchedulesBatch';

type Ref = { id: string };

function makeFakeBatch() {
  const sets: Array<{ ref: Ref; data: Record<string, unknown> }> = [];
  let commits = 0;
  return {
    sets,
    get commits() {
      return commits;
    },
    set(ref: Ref, data: Record<string, unknown>) {
      sets.push({ ref, data });
    },
    commit() {
      commits++;
      return Promise.resolve();
    },
  };
}

const TS = { __ts: 'serverTimestamp' };

const student = {
  name: 'أحمد',
  whatsapp: '0100',
  subject: 'رياضيات',
  classType: 'online',
  hourlyRate: 100,
  monthlyFee: 400,
  paymentStatus: 'unpaid',
  color: 'emerald',
  notes: '',
} as unknown as NewStudentInput;

const slots: NewScheduleForStudent[] = [
  { dayOfWeek: 0, time: '16:00', duration: 60, recurrence: 'weekly', classType: 'online', color: 'emerald' },
  { dayOfWeek: 2, time: '17:30', duration: 90, recurrence: 'weekly', classType: 'online', color: 'emerald' },
  { dayOfWeek: 4, time: '18:00', duration: 60, recurrence: 'weekly', classType: 'online', color: 'emerald' },
];

test('stageStudentWithSchedules stages exactly 1 student + N schedules and never commits', () => {
  const batch = makeFakeBatch();
  const refs = { student: { id: 'stu1' }, schedules: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };

  const out = stageStudentWithSchedules(batch, refs, 'teacherA', student, slots, TS);

  assert.equal(batch.sets.length, 4, 'one student + three schedules');
  assert.equal(batch.commits, 0, 'staging must not commit (the caller commits without awaiting)');
  assert.equal(out.studentId, 'stu1');
  assert.deepEqual(out.scheduleIds, ['s1', 's2', 's3']);

  const [studentWrite, ...scheduleWrites] = batch.sets;
  assert.equal(studentWrite.ref.id, 'stu1');
  assert.equal(studentWrite.data.id, 'stu1');
  assert.equal(studentWrite.data.teacherId, 'teacherA');
  assert.equal(studentWrite.data.name, 'أحمد');
  assert.equal(studentWrite.data.createdAt, TS);
  assert.equal(studentWrite.data.updatedAt, TS);

  scheduleWrites.forEach((w, i) => {
    assert.equal(w.data.id, refs.schedules[i].id);
    assert.equal(w.data.teacherId, 'teacherA');
    assert.equal(w.data.studentId, 'stu1', 'schedule is linked to the new student');
    assert.equal(w.data.studentName, 'أحمد');
    assert.equal(w.data.dayOfWeek, slots[i].dayOfWeek);
    assert.equal(w.data.time, slots[i].time);
    assert.equal(w.data.duration, slots[i].duration);
    assert.equal(w.data.recurrence, 'weekly');
    assert.equal(w.data.createdAt, TS);
    assert.equal(w.data.updatedAt, TS);
  });
});

test('stageStudentWithSchedules works with zero schedules', () => {
  const batch = makeFakeBatch();
  const out = stageStudentWithSchedules(batch, { student: { id: 'x' }, schedules: [] }, 't', student, [], TS);
  assert.equal(batch.sets.length, 1);
  assert.deepEqual(out.scheduleIds, []);
});

test('stageSchedules stages one write per slot and keeps the supplied studentId', () => {
  const batch = makeFakeBatch();
  const ids = stageSchedules(
    batch,
    [{ id: 'a' }, { id: 'b' }],
    'teacherB',
    [
      { studentId: 'stuX', studentName: 'سارة', ...slots[0] },
      { studentId: 'stuX', studentName: 'سارة', ...slots[1] },
    ],
    TS
  );
  assert.deepEqual(ids, ['a', 'b']);
  assert.equal(batch.sets.length, 2);
  assert.equal(batch.commits, 0);
  assert.ok(batch.sets.every((w) => w.data.studentId === 'stuX' && w.data.teacherId === 'teacherB'));
});

test('stageSchedules rejects mismatched refs/schedules', () => {
  const batch = makeFakeBatch();
  assert.throws(() => stageSchedules(batch, [{ id: 'a' }], 't', [], TS), /mismatch/);
  assert.equal(batch.sets.length, 0);
});
