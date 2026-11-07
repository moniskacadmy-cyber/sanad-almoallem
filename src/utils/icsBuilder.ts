/** Pure iCalendar (ICS) builder shared by the server feed and the in-app "add to calendar" button. No Node APIs. */

export interface FeedSlot {
  id: string;
  title: string; // e.g. "حصة: أحمد" / "مجموعة: الصف الثالث"
  dayOfWeek: number; // 0 = Sunday
  time: string; // HH:MM
  duration: number; // minutes
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'once';
  location?: string;
  description?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** RFC 5545 text escaping. */
export function escapeIcsText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,');
}

/** Folds a content line to 75 octets (UTF-8 aware), continuation lines start with one space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74; // leading space counts
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) parts.push(cur);
  return parts.join('\r\n ');
}

export function parseHHMM(time: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return { h, m: mm };
}

/** Next calendar date (local to the teacher) on or after `from` that falls on `dayOfWeek`. */
export function nextDateForDay(from: { y: number; mo: number; d: number; dow: number }, dayOfWeek: number) {
  const delta = (dayOfWeek - from.dow + 7) % 7;
  const base = new Date(Date.UTC(from.y, from.mo - 1, from.d + delta));
  return { y: base.getUTCFullYear(), mo: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

/** "Today" in a given IANA timezone. */
export function todayInTz(tz: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(now);
  } catch {
    return todayInTz('Africa/Cairo', now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { y: Number(get('year')), mo: Number(get('month')), d: Number(get('day')), dow: dows.indexOf(get('weekday')) };
}

export function safeTimeZone(tz: unknown): string {
  const v = typeof tz === 'string' && tz.trim() ? tz.trim() : 'Africa/Cairo';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return v;
  } catch {
    return 'Africa/Cairo';
  }
}

export interface BuildIcsInput {
  calendarName: string;
  timeZone: string;
  slots: FeedSlot[];
  alarmMinutes?: number[]; // default [15]
  now?: Date;
}

export function buildIcs({ calendarName, timeZone, slots, alarmMinutes = [15], now = new Date() }: BuildIcsInput): string {
  const tz = safeTimeZone(timeZone);
  const today = todayInTz(tz, now);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sanad Al-Moallem//Schedule//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${tz}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const s of slots) {
    const t = parseHHMM(s.time);
    if (!t || s.dayOfWeek < 0 || s.dayOfWeek > 6) continue;
    const date = nextDateForDay(today, s.dayOfWeek);
    const start = `${date.y}${pad(date.mo)}${pad(date.d)}T${pad(t.h)}${pad(t.m)}00`;
    const total = t.h * 60 + t.m + Math.max(5, Math.min(600, Number(s.duration) || 60));
    // End may roll past midnight: compute with a UTC date helper.
    const endDay = new Date(Date.UTC(date.y, date.mo - 1, date.d + Math.floor(total / 1440)));
    const endMin = total % 1440;
    const end = `${endDay.getUTCFullYear()}${pad(endDay.getUTCMonth() + 1)}${pad(endDay.getUTCDate())}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${String(s.id).replace(/[^A-Za-z0-9_-]/g, '')}@sanad-almoallem`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${tz}:${start}`);
    lines.push(`DTEND;TZID=${tz}:${end}`);
    if (s.recurrence === 'daily') lines.push('RRULE:FREQ=DAILY');
    else if (s.recurrence === 'monthly') lines.push('RRULE:FREQ=MONTHLY');
    else if (s.recurrence !== 'once') lines.push('RRULE:FREQ=WEEKLY');
    lines.push(`SUMMARY:${escapeIcsText(s.title)}`);
    if (s.location) lines.push(`LOCATION:${escapeIcsText(s.location)}`);
    if (s.description) lines.push(`DESCRIPTION:${escapeIcsText(s.description)}`);
    for (const m of alarmMinutes) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcsText(s.title)}`, `TRIGGER:-PT${Math.max(0, Math.round(m))}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
