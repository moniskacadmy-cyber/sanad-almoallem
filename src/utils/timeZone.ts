// src/utils/timeZone.ts
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

// Compatibility aliases for legacy date-fns-tz v2
export const utcToZonedTime = toZonedTime;
export const zonedTimeToUtc = fromZonedTime;

/**
 * Convert a date to Cairo timezone
 */
export function toCairoTime(date: Date = new Date()): Date {
  return toZonedTime(date, CAIRO_TZ);
}

/**
 * Convert a date in Cairo timezone back to UTC
 */
export function toUtcTime(date: Date): Date {
  return fromZonedTime(date, CAIRO_TZ);
}

/**
 * Get current date as YYYY-MM-DD in Cairo
 */
export function getCairoDateString(): string {
  const cairoDate = toCairoTime();
  const year = cairoDate.getFullYear();
  const month = String(cairoDate.getMonth() + 1).padStart(2, '0');
  const day = String(cairoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time as HH:MM in Cairo
 */
export function getCairoTimeString(): string {
  const cairoDate = toCairoTime();
  const hour = String(cairoDate.getHours()).padStart(2, '0');
  const minute = String(cairoDate.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Get current day of week in Cairo (0: Sunday, 6: Saturday)
 */
export function getCairoDayOfWeek(): number {
  return toCairoTime().getDay();
}

/**
 * Format 24-hour time string ("18:30" or "09:00") into 12-hour Arabic string (e.g. "6:30 مساءً", "9:00 صباحاً")
 */
export function formatTime12h(time24Str: string): string {
  if (!time24Str) return '';
  const clean = time24Str.trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;

  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return clean;

  const period = h < 12 ? 'صباحاً' : 'مساءً';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m === 0 ? '00' : m < 10 ? `0${m}` : String(m);

  return `${displayH}:${displayM} ${period}`;
}

/**
 * Format 24-hour time string with short period ("6:30 م", "9:00 ص")
 */
export function formatTime12hShort(time24Str: string): string {
  if (!time24Str) return '';
  const clean = time24Str.trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;

  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return clean;

  const period = h < 12 ? 'ص' : 'م';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m === 0 ? '00' : m < 10 ? `0${m}` : String(m);

  return `${displayH}:${displayM} ${period}`;
}

/**
 * Calculate end time string in 12-hour format from start time + duration
 */
export function formatTimeRange12h(startTime24: string, durationMinutes: number = 60): string {
  if (!startTime24) return '';
  const [h, m] = startTime24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return startTime24;

  const startFormatted = formatTime12h(startTime24);

  const totalMin = h * 60 + m + (durationMinutes || 60);
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endPeriod = endH < 12 ? 'صباحاً' : 'مساءً';
  const displayEndH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
  const displayEndM = endM === 0 ? '00' : endM < 10 ? `0${endM}` : String(endM);

  const endFormatted = `${displayEndH}:${displayEndM} ${endPeriod}`;
  return `${startFormatted} - ${endFormatted}`;
}
