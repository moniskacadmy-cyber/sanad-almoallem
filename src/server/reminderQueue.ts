/**
 * Core Reminder Queue Types, Shard Hashing, and Timezone Calculations
 * Designed for 100,000+ teachers with high throughput and zero periodic full-table scans.
 */

export const DEFAULT_SHARD_COUNT = 16;
export const DEFAULT_REMINDER_MINUTES_BEFORE = 15;
export const DEFAULT_LEASE_DURATION_MS = 60_000; // 60 seconds
export const MAX_RETRY_ATTEMPTS = 3;
export const TTL_RETENTION_DAYS = 3;

export type ReminderStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface ReminderQueueItem {
  id: string; // {teacherId}_{scheduleId}_{slotKey}
  teacherId: string;
  scheduleId: string;
  studentName: string;
  subject?: string;
  classType?: string;
  locationOrLink?: string;
  slotLocal: string; // e.g. "2026-10-07 16:00"
  fireAt: Date; // UTC Timestamp = slot start UTC minus reminderMinutesBefore
  status: ReminderStatus;
  attempts: number;
  leaseUntil: Date | null;
  tokens: string[]; // snapshot of <= 5 FCM tokens
  shard: number; // hash(teacherId) % SHARD_COUNT
  expireAt: Date; // fireAt + 3 days (for Firestore TTL)
  createdAt: Date;
  updatedAt: Date;
  error?: string | null;
  sentAt?: Date | null;
  teacherName?: string;
}

/**
 * Deterministic hash function (FNV-1a 32-bit) to partition teachers into shards.
 */
export function computeShard(teacherId: string, shardCount: number = DEFAULT_SHARD_COUNT): number {
  if (!teacherId || shardCount <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < teacherId.length; i++) {
    hash ^= teacherId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % shardCount;
}

/**
 * Pad number with leading zeroes
 */
export function padZero(num: number, size: number = 2): string {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

/**
 * Format slot key for unique document ID generation: yyyyMMddHHmm
 */
export function formatSlotKey(year: number, month: number, day: number, hour: number, minute: number): string {
  return `${year}${padZero(month)}${padZero(day)}${padZero(hour)}${padZero(minute)}`;
}

/**
 * Converts a local wall-clock time in any IANA timezone (with dynamic DST) into a UTC Date.
 * Handles DST transitions for Africa/Cairo, Asia/Riyadh, Europe/London, America/New_York, etc.
 */
export function localTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number, // 0-23
  minute: number, // 0-59
  timeZone: string = 'Africa/Cairo'
): Date {
  const validTz = (timeZone || 'Africa/Cairo').trim();

  // 1. Initial UTC estimate
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(guessUtc);
    const getVal = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

    const targetYear = getVal('year');
    const targetMonth = getVal('month');
    const targetDay = getVal('day');
    const targetHour = getVal('hour') % 24;
    const targetMinute = getVal('minute') % 60;

    const localAsUtc = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute);
    const offsetMs = localAsUtc - guessUtc.getTime();

    return new Date(guessUtc.getTime() - offsetMs);
  } catch (_e) {
    // Fallback: Default Cairo UTC+2/UTC+3
    return new Date(guessUtc.getTime() - 2 * 3600 * 1000);
  }
}

/**
 * Converts a UTC Date into local date parts in a given IANA timezone.
 */
export function utcToLocalParts(
  utcDate: Date,
  timeZone: string = 'Africa/Cairo'
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun..6=Sat
  formattedDate: string; // YYYY-MM-DD
  formattedTime: string; // HH:mm
} {
  const validTz = (timeZone || 'Africa/Cairo').trim();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(utcDate);
  const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getVal('year'), 10) || utcDate.getUTCFullYear();
  const month = parseInt(getVal('month'), 10) || (utcDate.getUTCMonth() + 1);
  const day = parseInt(getVal('day'), 10) || utcDate.getUTCDate();
  const hour = (parseInt(getVal('hour'), 10) || 0) % 24;
  const minute = (parseInt(getVal('minute'), 10) || 0) % 60;

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[getVal('weekday')] ?? utcDate.getUTCDay();

  const formattedDate = `${year}-${padZero(month)}-${padZero(day)}`;
  const formattedTime = `${padZero(hour)}:${padZero(minute)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek,
    formattedDate,
    formattedTime,
  };
}
