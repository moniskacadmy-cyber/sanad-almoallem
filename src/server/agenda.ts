/**
 * Pure helpers for push reminders: group classes, the morning summary, the login summary and
 * Do-Not-Disturb. No Firebase / Express imports, so everything here is unit-tested with plain Node.
 *
 * All "now" values are passed in already converted to the TEACHER's time zone
 * (dayOfWeek: 0 = Sunday ... 6 = Saturday, nowMinutes = minutes since local midnight), because
 * the server runs in UTC.
 */

export interface AgendaItem {
  /** Stable id used for de-duplication. Individual: schedule doc id. Group: g_<groupId>_<day>_<HHMM>. */
  id: string;
  kind: 'individual' | 'group';
  /** HH:MM (zero padded). */
  time: string;
  minutes: number;
  /** Student name (individual) or group name (group). */
  title: string;
  /** Center name for groups. */
  place?: string;
  subject?: string;
}

export interface DndLike {
  enabled?: boolean;
  startTime?: string;
  endTime?: string;
  muteWeekends?: boolean;
  vacationMode?: boolean;
}

/** "7:5" is rejected, "7:05" / "07:05" are accepted. Returns minutes since midnight or null. */
export function timeToMinutes(time: unknown): number | null {
  if (typeof time !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "7:05" -> "07:05" (null when invalid). */
export function normalizeTime(time: unknown): string | null {
  const minutes = timeToMinutes(time);
  if (minutes === null) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Active (not archived / paused) groups that meet on `dayOfWeek`. */
export function getGroupAgenda(groups: any[], dayOfWeek: number): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const g of groups || []) {
    if (!g || !g.id) continue;
    if (g.archived === true) continue;
    if (g.status === 'paused' || g.active === false) continue;
    const schedule = Array.isArray(g.schedule) ? g.schedule : [];
    const seen = new Set<string>();
    for (const slot of schedule) {
      if (!slot || Number(slot.day) !== dayOfWeek) continue;
      const time = normalizeTime(slot.time);
      if (!time) continue;
      const id = `g_${g.id}_${dayOfWeek}_${time.replace(':', '')}`;
      if (seen.has(id)) continue; // same group listed twice at the same time
      seen.add(id);
      out.push({
        id,
        kind: 'group',
        time,
        minutes: timeToMinutes(time) as number,
        title: String(g.name || 'مجموعة'),
        place: g.centerName ? String(g.centerName) : undefined,
        subject: g.subject ? String(g.subject) : undefined,
      });
    }
  }
  return out;
}

/**
 * Individual-student slots for `dayOfWeek` (the caller already queried by day, this re-checks it).
 * A slot already marked as done today is left out.
 */
export function getIndividualAgenda(slots: any[], dayOfWeek: number, todayStr?: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const s of slots || []) {
    if (!s || !s.id) continue;
    if (Number(s.dayOfWeek) !== dayOfWeek) continue;
    if (todayStr && s.completedTodayDate === todayStr) continue;
    const time = normalizeTime(s.time);
    if (!time) continue;
    out.push({
      id: String(s.id),
      kind: 'individual',
      time,
      minutes: timeToMinutes(time) as number,
      title: String(s.studentName || 'طالب'),
      subject: s.subject ? String(s.subject) : undefined,
    });
  }
  return out;
}

export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return [...items].sort((a, b) => a.minutes - b.minutes || a.title.localeCompare(b.title, 'ar'));
}

/** Items that start within the next `leadMinutes` minutes (strictly in the future). */
export function dueForReminder(items: AgendaItem[], nowMinutes: number, leadMinutes: number): AgendaItem[] {
  const lead = Number.isFinite(leadMinutes) && leadMinutes > 0 ? leadMinutes : 15;
  return items.filter((i) => {
    const diff = i.minutes - nowMinutes;
    return diff > 0 && diff <= lead;
  });
}

/**
 * True from `morningMinutes` until `windowMinutes` later (default 2h), so a cron tick that is a few
 * minutes late (or a missed minute) still sends the summary exactly once (the caller de-duplicates).
 */
export function isInMorningWindow(nowMinutes: number, morningMinutes: number, windowMinutes = 120): boolean {
  return nowMinutes >= morningMinutes && nowMinutes < Math.min(morningMinutes + windowMinutes, 24 * 60);
}

/** Do-Not-Disturb evaluated in the teacher's own time zone (the client helper uses the device clock). */
export function isMutedByDnd(dnd: DndLike | undefined | null, dayOfWeek: number, nowMinutes: number): boolean {
  if (!dnd || !dnd.enabled) return false;
  if (dnd.vacationMode) return true;
  if (dnd.muteWeekends && (dayOfWeek === 5 || dayOfWeek === 6)) return true; // Friday, Saturday

  const start = timeToMinutes(dnd.startTime);
  const end = timeToMinutes(dnd.endTime);
  if (start === null || end === null || start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end; // overnight, e.g. 22:00 -> 07:00
}

/** "09:30" -> "9:30 ص" / "17:00" -> "5:00 م" (12-hour, Arabic). */
export function formatTimeArabic(time: string): string {
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'م' : 'ص';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function itemLabel(i: AgendaItem): string {
  if (i.kind === 'group') return `مجموعة ${i.title}${i.place ? ` (${i.place})` : ''}`;
  return i.title;
}

export interface PushMessage {
  title: string;
  body: string;
  tag: string;
}

/** Reminder shown shortly before one class. */
export function buildClassReminderMessage(teacherName: string | undefined, item: AgendaItem): PushMessage {
  const name = teacherName || 'المعلم';
  const time = formatTimeArabic(item.time);
  if (item.kind === 'group') {
    return {
      title: '⏰ تذكير حصة المجموعة',
      body: `أستاذ/ـة ${name}، حصة ${itemLabel(item)} تبدأ الساعة ${time}.`,
      tag: 'class-reminder',
    };
  }
  return {
    title: '⏰ تذكير موعد الحصة القادمة',
    body: `أستاذ/ـة ${name}، لديك حصة قادمة مع الطالب (${item.title}) في تمام الساعة ${time}.`,
    tag: 'class-reminder',
  };
}

const MAX_LISTED = 4;

/** 1 -> حصة واحدة, 2 -> حصتين, 3-10 -> N حصص, 11+ -> N حصة. */
export function countLabel(n: number): string {
  if (n === 1) return 'حصة واحدة';
  if (n === 2) return 'حصتين';
  if (n >= 3 && n <= 10) return `${n} حصص`;
  return `${n} حصة`;
}

/**
 * Summary of today's classes.
 *  - 'morning': returns null when there is nothing to announce (no noisy "no classes" push every morning).
 *  - 'login'  : always returns a message (it also confirms that notifications work on this device).
 */
export function buildAgendaMessage(opts: {
  teacherName?: string;
  items: AgendaItem[];
  mode: 'morning' | 'login';
}): PushMessage | null {
  const items = sortAgenda(opts.items);
  const name = opts.teacherName || 'المعلم';

  if (items.length === 0) {
    if (opts.mode === 'morning') return null;
    return {
      title: '✅ الإشعارات شغالة',
      body: `أهلاً أستاذ/ـة ${name}، مفيش حصص مجدولة النهاردة. هيجيلك تنبيه قبل كل حصة وملخص كل صباح.`,
      tag: 'login-summary',
    };
  }

  const listed = items
    .slice(0, MAX_LISTED)
    .map((i) => `${formatTimeArabic(i.time)} ${itemLabel(i)}`)
    .join('، ');
  const more = items.length > MAX_LISTED ? ` و${items.length - MAX_LISTED} أخرى` : '';
  const count = countLabel(items.length);

  if (opts.mode === 'morning') {
    return {
      title: `☀️ صباح الخير يا أستاذ/ـة ${name}`,
      body: `عندك ${count} النهاردة: ${listed}${more}.`,
      tag: 'morning-summary',
    };
  }
  return {
    title: '✅ الإشعارات شغالة',
    body: `أهلاً أستاذ/ـة ${name}، عندك ${count} النهاردة: ${listed}${more}.`,
    tag: 'login-summary',
  };
}

export interface TokenEntry {
  token: string;
  /** Random id the app keeps in localStorage; the browser tab and the installed app on one phone share it. */
  deviceId?: string;
  /** Milliseconds of the last registration (updatedAt). */
  updatedMs: number;
}

/**
 * One notification per physical device: when several tokens carry the same deviceId (for example Chrome
 * and the installed app, or an old token after re-registering) only the newest token is kept.
 * Tokens without a deviceId (registered by older app versions) are all kept.
 */
export function pickLatestPerDevice<T extends TokenEntry>(items: T[]): { keep: T[]; drop: T[] } {
  const newest = new Map<string, T>();
  for (const it of items) {
    if (!it.deviceId) continue;
    const cur = newest.get(it.deviceId);
    if (!cur || it.updatedMs > cur.updatedMs) newest.set(it.deviceId, it);
  }
  const keep: T[] = [];
  const drop: T[] = [];
  for (const it of items) {
    if (!it.deviceId || newest.get(it.deviceId) === it) keep.push(it);
    else drop.push(it);
  }
  return { keep, drop };
}
