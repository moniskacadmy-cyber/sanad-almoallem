/**
 * Materializer for the Event-Driven Reminder Queue (48-Hour Lookahead)
 * Materializes schedule slots for active subscribed teachers into reminderQueue.
 */

import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import {
  DEFAULT_SHARD_COUNT,
  DEFAULT_REMINDER_MINUTES_BEFORE,
  TTL_RETENTION_DAYS,
  computeShard,
  formatSlotKey,
  localTimeToUtc,
  utcToLocalParts,
  ReminderQueueItem,
} from './reminderQueue.js';
import { evaluateSubscription } from './subscriptionAccess.js';
import { resolveDatabaseId } from '../../server.js';

export interface ScheduleRecord {
  id: string;
  studentName?: string;
  studentId?: string;
  subject?: string;
  dayOfWeek?: number; // 0=Sun..6=Sat
  time?: string; // HH:mm
  duration?: number;
  recurrence?: 'weekly' | 'daily' | 'monthly' | 'once';
  date?: string; // YYYY-MM-DD for once
  dayOfMonth?: number; // 1-31 for monthly
  classType?: string;
  locationOrLink?: string;
}

export interface MaterializeResult {
  teacherId: string;
  status: 'materialized' | 'skipped_inactive' | 'skipped_disabled' | 'error';
  generatedCount: number;
  updatedCount: number;
  deletedCount: number;
  error?: string;
}

function getDb() {
  const dbId = resolveDatabaseId();
  const appAdmin = getApps()[0];
  return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
}

/**
 * Calculates all scheduled slots for a given schedule within the next 48 hours.
 */
export function calculateNext48HourSlots(
  schedule: ScheduleRecord,
  timeZone: string,
  nowUtc: Date = new Date()
): { localDateStr: string; localTimeStr: string; slotUtc: Date; slotKey: string }[] {
  const slots: { localDateStr: string; localTimeStr: string; slotUtc: Date; slotKey: string }[] = [];
  if (!schedule || !schedule.time || !schedule.time.includes(':')) {
    return slots;
  }

  const [hourStr, minStr] = schedule.time.split(':');
  const slotHour = parseInt(hourStr, 10);
  const slotMin = parseInt(minStr, 10);
  if (Number.isNaN(slotHour) || Number.isNaN(slotMin)) return slots;

  const recurrence = schedule.recurrence || 'weekly';

  // We scan 3 local calendar dates (day 0, day 1, day 2) to cover the 48-hour UTC window across any timezone.
  const localNow = utcToLocalParts(nowUtc, timeZone);
  const startDayMs = Date.UTC(localNow.year, localNow.month - 1, localNow.day);

  for (let offset = 0; offset <= 2; offset++) {
    const targetDate = new Date(startDayMs + offset * 86400000);
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth() + 1;
    const day = targetDate.getUTCDate();
    const dayOfWeek = targetDate.getUTCDay(); // 0=Sun..6=Sat
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    let matches = false;

    if (recurrence === 'daily') {
      matches = true;
    } else if (recurrence === 'weekly') {
      matches = schedule.dayOfWeek === dayOfWeek;
    } else if (recurrence === 'monthly') {
      matches = schedule.dayOfMonth === day;
    } else if (recurrence === 'once') {
      matches = schedule.date === dateStr;
    }

    if (matches) {
      const slotUtc = localTimeToUtc(year, month, day, slotHour, slotMin, timeZone);
      const slotKey = formatSlotKey(year, month, day, slotHour, slotMin);

      // Check if slot falls within now - 5 minutes to now + 48 hours
      const diffFromNow = slotUtc.getTime() - nowUtc.getTime();
      if (diffFromNow >= -5 * 60 * 1000 && diffFromNow <= 48 * 3600 * 1000) {
        slots.push({
          localDateStr: dateStr,
          localTimeStr: schedule.time,
          slotUtc,
          slotKey,
        });
      }
    }
  }

  return slots;
}

/**
 * Materializes reminders for a single teacher into reminderQueue (idempotent, 48-hour lookahead).
 */
export async function materializeRemindersForTeacher(
  teacherId: string,
  nowUtc: Date = new Date(),
  shardCount: number = DEFAULT_SHARD_COUNT,
  injectedDb?: FirebaseFirestore.Firestore
): Promise<MaterializeResult> {
  const db = injectedDb || getDb();
  const shard = computeShard(teacherId, shardCount);

  try {
    const teacherDocRef = db.collection('teachers').doc(teacherId);
    const teacherDoc = await teacherDocRef.get();

    if (!teacherDoc.exists) {
      // Clean up any remaining pending reminders if teacher document is gone
      const deleted = await cleanupTeacherPendingReminders(db, teacherId);
      return {
        teacherId,
        status: 'skipped_inactive',
        generatedCount: 0,
        updatedCount: 0,
        deletedCount: deleted,
      };
    }

    const teacherData = teacherDoc.data() || {};

    // 1. Subscription & Notification status check
    const isSubActive = evaluateSubscription(teacherData, nowUtc) === 'active';
    const isRemindersEnabled =
      teacherData.remindersEnabled !== false &&
      teacherData.teacherNotificationsEnabled !== false;

    if (!isSubActive || !isRemindersEnabled) {
      const deleted = await cleanupTeacherPendingReminders(db, teacherId);
      return {
        teacherId,
        status: !isSubActive ? 'skipped_inactive' : 'skipped_disabled',
        generatedCount: 0,
        updatedCount: 0,
        deletedCount: deleted,
      };
    }

    const timeZone = teacherData.timezone || 'Africa/Cairo';
    const minutesBefore = Number(teacherData.reminderMinutesBefore) || DEFAULT_REMINDER_MINUTES_BEFORE;

    // 2. Fetch active FCM tokens (limit 5)
    const tokensSnap = await teacherDocRef.collection('fcmTokens').limit(5).get();
    const tokens: string[] = [];
    tokensSnap.forEach((tDoc) => {
      const tData = tDoc.data();
      const token = tData?.token || tDoc.id;
      if (token && typeof token === 'string' && !tokens.includes(token)) {
        tokens.push(token);
      }
    });

    // 3. Fetch all schedules for this teacher
    const schedulesSnap = await teacherDocRef.collection('schedules').get();
    const schedules: ScheduleRecord[] = [];
    schedulesSnap.forEach((sDoc) => {
      schedules.push({
        id: sDoc.id,
        ...(sDoc.data() as any),
      });
    });

    // 4. Calculate candidate 48-hour reminder items
    const candidateMap = new Map<string, Partial<ReminderQueueItem>>();

    for (const schedule of schedules) {
      const nextSlots = calculateNext48HourSlots(schedule, timeZone, nowUtc);
      for (const slot of nextSlots) {
        const fireAtMs = slot.slotUtc.getTime() - minutesBefore * 60 * 1000;
        const fireAt = new Date(fireAtMs);
        const expireAt = new Date(fireAtMs + TTL_RETENTION_DAYS * 86400000);
        const docId = `${teacherId}_${schedule.id}_${slot.slotKey}`;

        candidateMap.set(docId, {
          id: docId,
          teacherId,
          scheduleId: schedule.id,
          studentName: schedule.studentName || 'طالب',
          subject: schedule.subject || teacherData.subject || 'المادة',
          classType: schedule.classType || 'online',
          locationOrLink: schedule.locationOrLink || '',
          slotLocal: `${slot.localDateStr} ${slot.localTimeStr}`,
          fireAt,
          status: 'pending',
          attempts: 0,
          leaseUntil: null,
          tokens,
          shard,
          expireAt,
          createdAt: nowUtc,
          updatedAt: nowUtc,
          teacherName: teacherData.name || 'المعلم',
        });
      }
    }

    // 5. Query existing queue items for this teacher
    const existingQueueSnap = await db
      .collection('reminderQueue')
      .where('teacherId', '==', teacherId)
      .get();

    let generatedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    const batch = db.batch();
    let operationsInBatch = 0;

    for (const docSnap of existingQueueSnap.docs) {
      const existingId = docSnap.id;
      const existingData = docSnap.data();

      if (candidateMap.has(existingId)) {
        // Candidate matches an existing document
        const candidate = candidateMap.get(existingId)!;
        candidateMap.delete(existingId); // Processed

        // Never overwrite 'sent' or active 'processing' items back to pending
        if (existingData.status === 'pending') {
          // Update tokens and mutable fields
          const ref = db.collection('reminderQueue').doc(existingId);
          batch.update(ref, {
            tokens: candidate.tokens,
            studentName: candidate.studentName,
            subject: candidate.subject,
            fireAt: Timestamp.fromDate(candidate.fireAt!),
            expireAt: Timestamp.fromDate(candidate.expireAt!),
            updatedAt: Timestamp.fromDate(nowUtc),
          });
          operationsInBatch++;
          updatedCount++;
        }
      } else {
        // Obsolete pending item (schedule was deleted or changed)
        if (existingData.status === 'pending') {
          batch.delete(docSnap.ref);
          operationsInBatch++;
          deletedCount++;
        }
      }
    }

    // Insert remaining new candidates
    for (const [docId, candidate] of candidateMap.entries()) {
      const ref = db.collection('reminderQueue').doc(docId);
      batch.set(ref, {
        ...candidate,
        fireAt: Timestamp.fromDate(candidate.fireAt!),
        expireAt: Timestamp.fromDate(candidate.expireAt!),
        createdAt: Timestamp.fromDate(candidate.createdAt!),
        updatedAt: Timestamp.fromDate(candidate.updatedAt!),
        leaseUntil: candidate.leaseUntil ? Timestamp.fromDate(candidate.leaseUntil) : null,
      });
      operationsInBatch++;
      generatedCount++;
    }

    if (operationsInBatch > 0) {
      await batch.commit();
    }

    return {
      teacherId,
      status: 'materialized',
      generatedCount,
      updatedCount,
      deletedCount,
    };
  } catch (err: any) {
    console.error(`Error materializing reminders for teacher ${teacherId}:`, err);
    return {
      teacherId,
      status: 'error',
      generatedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      error: err?.message || String(err),
    };
  }
}

/**
 * Helper to clean up all pending reminders for a deactivated or deleted teacher.
 */
async function cleanupTeacherPendingReminders(
  db: FirebaseFirestore.Firestore,
  teacherId: string
): Promise<number> {
  const snap = await db
    .collection('reminderQueue')
    .where('teacherId', '==', teacherId)
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

/**
 * Daily Batch Re-materialization for all active teachers using cursor pagination.
 * Scales to 100,000+ teachers with bounded memory consumption.
 */
export async function materializeAllActiveTeachers(
  pageSize: number = 200,
  concurrency: number = 10,
  injectedDb?: FirebaseFirestore.Firestore
): Promise<{ totalProcessed: number; materialized: number; skipped: number; errors: number }> {
  const db = injectedDb || getDb();
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;

  let totalProcessed = 0;
  let materialized = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();

  while (hasMore) {
    let query = db.collection('teachers').orderBy('__name__').limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }

    const teacherDocs = snap.docs;
    lastDoc = teacherDocs[teacherDocs.length - 1];

    // Process page with bounded concurrency pool
    const queue = [...teacherDocs];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const doc = queue.shift();
        if (!doc) break;
        totalProcessed++;

        const res = await materializeRemindersForTeacher(doc.id, now, DEFAULT_SHARD_COUNT, db);
        if (res.status === 'materialized') {
          materialized++;
        } else if (res.status === 'error') {
          errors++;
        } else {
          skipped++;
        }
      }
    });

    await Promise.all(workers);

    if (teacherDocs.length < pageSize) {
      hasMore = false;
    }
  }

  console.log(
    JSON.stringify({
      event: 'materialize_all_completed',
      totalProcessed,
      materialized,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    })
  );

  return { totalProcessed, materialized, skipped, errors };
}
