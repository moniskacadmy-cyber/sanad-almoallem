import type { Student, ScheduleSlot } from '../types';

/**
 * Pure helpers that stage a new student + its weekly schedule slots into ONE Firestore write batch.
 * They only call `batch.set(...)`; they never call `commit()`, so the caller decides when/how to
 * commit and the UI can avoid waiting for the server acknowledgement.
 * Kept free of any firebase imports so it can be unit tested without the SDK.
 */

export interface BatchLike<R = unknown> {
  set(ref: R, data: Record<string, unknown>): unknown;
}

export interface DocRefLike {
  id: string;
}

export type NewStudentInput = Omit<Student, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>;

/** A schedule slot as supplied by the UI (ids/timestamps are added here). */
export type NewScheduleInput = Omit<ScheduleSlot, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>;

/** Schedule slot whose studentId / studentName are filled from the student being created. */
export type NewScheduleForStudent = Omit<NewScheduleInput, 'studentId' | 'studentName'>;

export function stageSchedules<R extends DocRefLike>(
  batch: BatchLike<R>,
  scheduleRefs: R[],
  teacherId: string,
  schedules: NewScheduleInput[],
  timestamp: unknown
): string[] {
  if (scheduleRefs.length !== schedules.length) {
    throw new Error('stageSchedules: refs and schedules length mismatch');
  }
  return schedules.map((schedule, i) => {
    const ref = scheduleRefs[i];
    batch.set(ref, {
      ...schedule,
      id: ref.id,
      teacherId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return ref.id;
  });
}

export function stageStudentWithSchedules<R extends DocRefLike>(
  batch: BatchLike<R>,
  refs: { student: R; schedules: R[] },
  teacherId: string,
  student: NewStudentInput,
  schedules: NewScheduleForStudent[],
  timestamp: unknown
): { studentId: string; scheduleIds: string[] } {
  batch.set(refs.student, {
    ...student,
    id: refs.student.id,
    teacherId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const scheduleIds = stageSchedules(
    batch,
    refs.schedules,
    teacherId,
    schedules.map((s) => ({
      ...s,
      studentId: refs.student.id,
      studentName: student.name,
    })),
    timestamp
  );

  return { studentId: refs.student.id, scheduleIds };
}
