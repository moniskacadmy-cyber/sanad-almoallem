/**
 * Partitioned Sharded Reminder Dispatcher
 * Dispatches due reminders in parallel across N shards using atomic transaction claiming and FCM Multicast.
 */

import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import {
  DEFAULT_SHARD_COUNT,
  DEFAULT_LEASE_DURATION_MS,
  MAX_RETRY_ATTEMPTS,
  formatSlotKey,
  utcToLocalParts,
} from './reminderQueue.js';
import { buildMobilePushPayload, chunkFcmTokens, resolveDatabaseId } from '../../server.js';
import { alertsService } from './alertsService.js';

export interface DispatcherOptions {
  now?: Date;
  shardCount?: number;
  shards?: number[];
  maxDurationMs?: number;
  batchSize?: number;
}

export interface DispatchSummary {
  success: boolean;
  dispatchedCount: number;
  failedCount: number;
  reclaimedCount: number;
  maxLagSeconds: number;
  durationMs: number;
  shardsProcessed: number;
  statsDocId: string;
}

function getDb() {
  const dbId = resolveDatabaseId();
  const appAdmin = getApps()[0];
  return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
}

function getMessaging() {
  const appAdmin = getApps()[0];
  return getAdminMessaging(appAdmin);
}

/**
 * Dispatches due reminders across all shards in parallel.
 */
export async function dispatchReminderQueue(
  options: DispatcherOptions = {},
  injectedDeps?: {
    db?: FirebaseFirestore.Firestore;
    messaging?: { sendEachForMulticast: (payload: any) => Promise<any> };
  }
): Promise<DispatchSummary> {
  const startTime = Date.now();
  const now = options.now || new Date();
  const shardCount = options.shardCount || DEFAULT_SHARD_COUNT;
  const shardsToProcess =
    options.shards && options.shards.length > 0
      ? options.shards
      : Array.from({ length: shardCount }, (_, i) => i);
  const maxDurationMs = options.maxDurationMs || 50_000;
  const batchLimit = options.batchSize || 500;

  const db = injectedDeps?.db || getDb();
  const messaging = injectedDeps?.messaging || getMessaging();

  let totalDispatched = 0;
  let totalFailed = 0;
  let totalReclaimed = 0;
  let maxLagSeconds = 0;

  const nowTimestamp = Timestamp.fromDate(now);

  // Process all designated shards concurrently
  const shardPromises = shardsToProcess.map(async (shardId) => {
    let shardDispatched = 0;
    let shardFailed = 0;
    let shardReclaimed = 0;
    let shardMaxLag = 0;

    while (Date.now() - startTime < maxDurationMs) {
      // 1. Fetch due pending reminders for this shard
      const pendingSnap = await db
        .collection('reminderQueue')
        .where('shard', '==', shardId)
        .where('status', '==', 'pending')
        .where('fireAt', '<=', nowTimestamp)
        .orderBy('fireAt', 'asc')
        .limit(batchLimit)
        .get();

      // 2. Fetch expired leases to reclaim
      const staleLeaseSnap = await db
        .collection('reminderQueue')
        .where('shard', '==', shardId)
        .where('status', '==', 'processing')
        .where('leaseUntil', '<=', nowTimestamp)
        .where('attempts', '<', MAX_RETRY_ATTEMPTS)
        .limit(100)
        .get();

      const candidateDocs = [...pendingSnap.docs, ...staleLeaseSnap.docs];
      if (candidateDocs.length === 0) {
        break; // No more work for this shard in this window
      }

      // Process candidates in this batch
      for (const docSnap of candidateDocs) {
        if (Date.now() - startTime >= maxDurationMs) break;

        const docRef = docSnap.ref;
        let itemData: any = null;
        let isReclaim = false;

        // Atomic Transaction Claim
        const claimed = await db.runTransaction(async (transaction) => {
          const freshDoc = await transaction.get(docRef);
          if (!freshDoc.exists) return false;

          const data = freshDoc.data()!;
          const status = data.status;
          const attempts = Number(data.attempts) || 0;
          const leaseUntilDate = data.leaseUntil?.toDate ? data.leaseUntil.toDate() : null;

          const isPending = status === 'pending';
          const isStaleLease =
            status === 'processing' &&
            leaseUntilDate &&
            leaseUntilDate.getTime() <= now.getTime() &&
            attempts < MAX_RETRY_ATTEMPTS;

          if (!isPending && !isStaleLease) {
            return false;
          }

          if (isStaleLease) {
            isReclaim = true;
          }

          const newAttempts = attempts + 1;
          const newLease = new Date(now.getTime() + DEFAULT_LEASE_DURATION_MS);

          transaction.update(docRef, {
            status: 'processing',
            attempts: newAttempts,
            leaseUntil: Timestamp.fromDate(newLease),
            updatedAt: Timestamp.fromDate(now),
          });

          itemData = {
            ...data,
            attempts: newAttempts,
          };
          return true;
        }).catch(() => false);

        if (!claimed || !itemData) {
          continue;
        }

        if (isReclaim) {
          shardReclaimed++;
        }

        // Calculate lag from scheduled fireAt
        const fireAtDate = itemData.fireAt?.toDate ? itemData.fireAt.toDate() : new Date(itemData.fireAt);
        const lagSec = Math.max(0, Math.floor((now.getTime() - fireAtDate.getTime()) / 1000));
        if (lagSec > shardMaxLag) {
          shardMaxLag = lagSec;
        }
        if (lagSec > 120) {
          alertsService.checkReminderDelayAlert(fireAtDate.getTime(), now.getTime(), {
            shard: shardId,
            reminderId: docRef.id,
            teacherId: itemData.teacherId,
            scheduleId: itemData.scheduleId,
          });
        }

        const tokens: string[] = Array.isArray(itemData.tokens) ? itemData.tokens : [];

        if (tokens.length === 0) {
          // No tokens available -> Mark as sent or failed gracefully without error loop
          await docRef.update({
            status: 'sent',
            sentAt: Timestamp.fromDate(now),
            leaseUntil: null,
            error: 'No active device tokens found for teacher',
          });
          shardDispatched++;
          continue;
        }

        // Send FCM multicast
        const title = '⏰ تذكير موعد الحصة القادمة';
        const body = `أستاذ/ـة ${itemData.teacherName || 'المعلم'}، لديك حصة قادمة مع الطالب (${itemData.studentName || 'طالب'}) في موعدها المحدد (${itemData.slotLocal || ''}).`;

        let successCount = 0;
        let failureError: string | null = null;
        const deadTokens: string[] = [];

        const chunks = chunkFcmTokens(tokens, 500);

        for (const chunk of chunks) {
          try {
            const payload = buildMobilePushPayload({
              tokens: chunk,
              title,
              body,
              scheduleId: itemData.scheduleId,
              studentName: itemData.studentName || '',
              time: itemData.slotLocal || '',
              tag: 'class-reminder',
            });

            // Ensure webpush headers conform to requirements: Urgency=high, TTL=600
            if (payload.webpush?.headers) {
              payload.webpush.headers.Urgency = 'high';
              payload.webpush.headers.TTL = '600';
            }

            const sendResponse = await messaging.sendEachForMulticast(payload);
            successCount += sendResponse.successCount || 0;

            // Collect dead tokens to clean up
            if (Array.isArray(sendResponse.responses)) {
              sendResponse.responses.forEach((resp: any, idx: number) => {
                if (!resp.success && resp.error) {
                  const errCode = resp.error.code;
                  if (
                    errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered'
                  ) {
                    const badToken = chunk[idx];
                    if (badToken) deadTokens.push(badToken);
                  }
                }
              });
            }
          } catch (sendErr: any) {
            failureError = sendErr?.message || String(sendErr);
            console.error(`FCM dispatch error for queue item ${docSnap.id}:`, sendErr);
          }
        }

        // Clean up dead tokens asynchronously
        if (deadTokens.length > 0 && itemData.teacherId) {
          cleanUpDeadFcmTokens(db, itemData.teacherId, deadTokens).catch(() => {});
        }

        // Update document status based on outcome
        if (successCount > 0) {
          await docRef.update({
            status: 'sent',
            sentAt: Timestamp.fromDate(now),
            leaseUntil: null,
            error: null,
          });
          shardDispatched++;
        } else {
          if (itemData.attempts >= MAX_RETRY_ATTEMPTS) {
            await docRef.update({
              status: 'failed',
              leaseUntil: null,
              error: failureError || 'All multicast attempts failed after max retries',
            });
            shardFailed++;
          } else {
            // Exponential backoff retry: attempts * 30 seconds
            const nextFireAt = new Date(now.getTime() + itemData.attempts * 30_000);
            await docRef.update({
              status: 'pending',
              fireAt: Timestamp.fromDate(nextFireAt),
              leaseUntil: null,
              error: failureError || 'Multicast send failed, scheduled retry',
            });
          }
        }
      }

      // If less than batch limit was returned, we drained the current pending backlog for this shard
      if (pendingSnap.size < batchLimit) {
        break;
      }
    }

    return {
      dispatched: shardDispatched,
      failed: shardFailed,
      reclaimed: shardReclaimed,
      maxLag: shardMaxLag,
    };
  });

  const shardResults = await Promise.all(shardPromises);

  shardResults.forEach((res) => {
    totalDispatched += res.dispatched;
    totalFailed += res.failed;
    totalReclaimed += res.reclaimed;
    if (res.maxLag > maxLagSeconds) {
      maxLagSeconds = res.maxLag;
    }
  });

  const durationMs = Date.now() - startTime;

  // Format stats document ID: yyyyMMddHHmm (UTC)
  const localNow = utcToLocalParts(now, 'UTC');
  const statsDocId = formatSlotKey(
    localNow.year,
    localNow.month,
    localNow.day,
    localNow.hour,
    localNow.minute
  );

  // Write operational metrics to ops/reminderStats/{yyyyMMddHHmm}
  try {
    await db.collection('ops').doc('reminderStats').collection('minuteStats').doc(statsDocId).set(
      {
        statsDocId,
        sentCount: totalDispatched,
        failedCount: totalFailed,
        reclaimedCount: totalReclaimed,
        maxLagSeconds,
        durationMs,
        shardsProcessed: shardsToProcess.length,
        timestamp: Timestamp.fromDate(now),
      },
      { merge: true }
    );
  } catch (metricsErr) {
    console.warn('Failed to record ops stats:', metricsErr);
  }

  // Structured JSON Log for Cloud Logging / Observability
  console.log(
    JSON.stringify({
      event: 'reminder_dispatch_completed',
      statsDocId,
      sentCount: totalDispatched,
      failedCount: totalFailed,
      reclaimedCount: totalReclaimed,
      maxLagSeconds,
      durationMs,
      shardsProcessed: shardsToProcess.length,
      timestamp: now.toISOString(),
    })
  );

  return {
    success: true,
    dispatchedCount: totalDispatched,
    failedCount: totalFailed,
    reclaimedCount: totalReclaimed,
    maxLagSeconds,
    durationMs,
    shardsProcessed: shardsToProcess.length,
    statsDocId,
  };
}

/**
 * Removes invalid / unregistered FCM tokens from teachers/{teacherId}/fcmTokens
 */
export async function cleanUpDeadFcmTokens(
  db: FirebaseFirestore.Firestore,
  teacherId: string,
  deadTokens: string[]
): Promise<void> {
  if (!deadTokens || deadTokens.length === 0 || !teacherId) return;

  const batch = db.batch();
  for (const token of deadTokens) {
    const tokenRef = db
      .collection('teachers')
      .doc(teacherId)
      .collection('fcmTokens')
      .doc(token);
    batch.delete(tokenRef);
  }
  await batch.commit().catch((err) => {
    console.warn(`Failed to clean up dead FCM tokens for teacher ${teacherId}:`, err);
  });
}
