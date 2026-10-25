import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStudentPaused,
  getStudentEffectiveStatus,
  getStudentStatusMeta,
  getPauseEndingSoonStudents,
  getDaysDiff,
} from '../src/services/studentStatus.ts';
import { Student } from '../src/types.ts';

test('getDaysDiff calculates day differences correctly', () => {
  assert.equal(getDaysDiff('2026-10-25', '2026-10-25'), 0);
  assert.equal(getDaysDiff('2026-10-25', '2026-10-26'), 1);
  assert.equal(getDaysDiff('2026-10-25', '2026-10-27'), 2);
  assert.equal(getDaysDiff('2026-10-25', '2026-10-24'), -1);
});

test('isStudentPaused: active student is not paused', () => {
  const activeStudent: Partial<Student> = {
    status: 'active',
    active: true,
  };
  assert.equal(isStudentPaused(activeStudent as any, '2026-10-25'), false);
  assert.equal(getStudentEffectiveStatus(activeStudent as any, '2026-10-25'), 'active');
});

test('isStudentPaused: permanent pause is always paused', () => {
  const pausedStudent: Partial<Student> = {
    status: 'paused',
    pauseType: 'permanent',
  };
  assert.equal(isStudentPaused(pausedStudent as any, '2026-10-25'), true);
  assert.equal(getStudentEffectiveStatus(pausedStudent as any, '2026-10-25'), 'paused');
});

test('isStudentPaused: temporary pause respects dates', () => {
  const tempPaused: Partial<Student> = {
    status: 'paused',
    pauseType: 'temporary',
    pauseStartDate: '2026-10-20',
    pauseEndDate: '2026-10-30',
  };

  // Before pause
  assert.equal(isStudentPaused(tempPaused as any, '2026-10-15'), false);
  // Start date
  assert.equal(isStudentPaused(tempPaused as any, '2026-10-20'), true);
  // Inside pause
  assert.equal(isStudentPaused(tempPaused as any, '2026-10-25'), true);
  // End date
  assert.equal(isStudentPaused(tempPaused as any, '2026-10-30'), true);
  // After end date
  assert.equal(isStudentPaused(tempPaused as any, '2026-10-31'), false);
});

test('isStudentPaused: archived student is always paused/archived', () => {
  const archivedStudent: Partial<Student> = {
    archived: true,
    status: 'archived',
  };
  assert.equal(isStudentPaused(archivedStudent as any, '2026-10-25'), true);
  assert.equal(getStudentEffectiveStatus(archivedStudent as any, '2026-10-25'), 'archived');
});

test('getStudentStatusMeta identifies ending soon pause', () => {
  const endingTomorrow: Partial<Student> = {
    name: 'Tarek',
    status: 'paused',
    pauseType: 'temporary',
    pauseStartDate: '2026-10-15',
    pauseEndDate: '2026-10-26',
  };
  const meta = getStudentStatusMeta(endingTomorrow as any, '2026-10-25');
  assert.equal(meta.status, 'paused');
  assert.equal(meta.isTemporary, true);
  assert.equal(meta.daysRemaining, 1);
  assert.equal(meta.isEndingSoon, true);
});

test('getPauseEndingSoonStudents collects students whose pause is ending within threshold', () => {
  const s1: Student = {
    id: 's1',
    name: 'Ahmed',
    status: 'paused',
    pauseType: 'temporary',
    pauseStartDate: '2026-10-10',
    pauseEndDate: '2026-10-26', // in 1 day
  } as any;

  const s2: Student = {
    id: 's2',
    name: 'Mona',
    status: 'paused',
    pauseType: 'temporary',
    pauseStartDate: '2026-10-10',
    pauseEndDate: '2026-10-27', // in 2 days
  } as any;

  const s3: Student = {
    id: 's3',
    name: 'Khaled',
    status: 'paused',
    pauseType: 'temporary',
    pauseStartDate: '2026-10-10',
    pauseEndDate: '2026-11-15', // far away
  } as any;

  const s4: Student = {
    id: 's4',
    name: 'Sara',
    status: 'active',
  } as any;

  const endingSoon = getPauseEndingSoonStudents([s1, s2, s3, s4], 2);
  assert.equal(endingSoon.length, 2);
  assert.equal(endingSoon[0].student.id, 's1');
  assert.equal(endingSoon[1].student.id, 's2');
});
