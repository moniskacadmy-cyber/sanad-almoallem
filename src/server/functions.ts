/**
 * Cloud Functions (Firebase Gen2 / Blaze)
 * Event-Driven Materializer Triggers and Scheduled Cron Runners
 */

import { materializeRemindersForTeacher, materializeAllActiveTeachers } from './reminderMaterializer.js';
import { dispatchReminderQueue } from './reminderDispatcher.js';

/**
 * Trigger when a schedule is created, updated, or deleted
 */
export async function onScheduleWrittenHandler(
  teacherId: string,
  _scheduleId: string
): Promise<void> {
  if (!teacherId) return;
  await materializeRemindersForTeacher(teacherId);
}

/**
 * Trigger when a teacher profile or subscription changes
 */
export async function onTeacherWrittenHandler(
  teacherId: string
): Promise<void> {
  if (!teacherId) return;
  await materializeRemindersForTeacher(teacherId);
}

/**
 * Trigger when FCM tokens are added or removed
 */
export async function onFcmTokenWrittenHandler(
  teacherId: string
): Promise<void> {
  if (!teacherId) return;
  await materializeRemindersForTeacher(teacherId);
}

/**
 * Scheduled cron: Dispatcher runs every 1 minute
 */
export async function onMinuteDispatcherHandler(): Promise<any> {
  return await dispatchReminderQueue();
}

/**
 * Scheduled cron: Full materialization runs daily
 */
export async function onDailyMaterializeHandler(): Promise<any> {
  return await materializeAllActiveTeachers();
}
