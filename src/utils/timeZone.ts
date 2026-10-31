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
