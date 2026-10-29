import { createHash, randomBytes } from 'node:crypto';

/**
 * Parent portal helpers (pure, no Firebase). The portal is READ ONLY and never talks to Firestore directly:
 * the server validates the parent code and builds a whitelisted view of ONE student.
 */

export interface ParentLinkDoc {
  teacherId: string;
  studentId: string;
  codeHash: string;
  code: string; // plaintext kept server-side only so the teacher can re-copy the link
  createdAtMs: number;
  expiresAtMs: number;
  revoked: boolean;
}

/** 192-bit random code, URL safe (32 chars). */
export function generateParentCode(): string {
  return randomBytes(24).toString('base64url');
}

export function hashParentCode(code: string): string {
  return createHash('sha256').update(String(code).trim()).digest('hex');
}

export function isPlausibleParentCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(code.trim());
}

export function clampExpiryDays(days: unknown): number {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return 90;
  return Math.min(Math.max(Math.round(n), 1), 365);
}

export type LinkStatus = 'ok' | 'revoked' | 'expired';

export function linkStatus(link: Pick<ParentLinkDoc, 'revoked' | 'expiresAtMs'>, nowMs = Date.now()): LinkStatus {
  if (link.revoked) return 'revoked';
  if (!(link.expiresAtMs > nowMs)) return 'expired';
  return 'ok';
}

/** YYYY-MM-DD, `days` days before `now` (UTC based, good enough for a 30-day window). */
export function daysAgoDateStr(days: number, now = new Date()): string {
  const d = new Date(now.getTime() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

type AttendanceView = 'present' | 'absent' | 'late' | 'excused';

function normAttendance(v: unknown): AttendanceView | null {
  if (v === 'present' || v === 'absent' || v === 'late' || v === 'excused') return v;
  return null;
}

export interface ParentViewInput {
  teacherName?: string;
  student: Record<string, any>;
  attendance: Record<string, any>[]; // teachers/{t}/attendance rows of THIS student
  lessons: Record<string, any>[]; // students/{s}/lessons rows
  schedules: Record<string, any>[]; // individual slots of THIS student
  groupSlots: { groupName?: string; day: number; time: string; duration?: number }[];
  library: Record<string, any>[]; // already filtered by sharedWithStudentIds
  payments: Record<string, any>[]; // student's payment records
  showFinance: boolean;
  today?: string;
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Builds the ONLY shape a parent can ever receive. Every field is copied explicitly (whitelist),
 * so new internal fields can never leak by accident (rates, costs, phone numbers, teacher data, other students).
 */
export function buildParentView(input: ParentViewInput) {
  const today = input.today || new Date().toISOString().slice(0, 10);
  const since = daysAgoDateStr(30, new Date(today + 'T12:00:00Z'));

  // Attendance: merge attendance records and lesson logs, one row per date.
  const byDate = new Map<string, { date: string; status: AttendanceView; note: string }>();
  for (const l of input.lessons) {
    const date = str(l.date, 10);
    const status = normAttendance(l.attendance);
    if (!date || date < since || !status) continue;
    byDate.set(date, { date, status, note: '' });
  }
  for (const a of input.attendance) {
    const date = str(a.date, 10);
    const status = normAttendance(a.status);
    if (!date || date < since || !status) continue;
    byDate.set(date, { date, status, note: str(a.notes, 200) });
  }
  const attendance = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const summary = {
    present: attendance.filter((x) => x.status === 'present').length,
    late: attendance.filter((x) => x.status === 'late').length,
    absent: attendance.filter((x) => x.status === 'absent').length,
    excused: attendance.filter((x) => x.status === 'excused').length,
  };

  const lessons = input.lessons
    .filter((l) => str(l.date, 10) >= since)
    .map((l) => ({
      date: str(l.date, 10),
      topic: str(l.topic, 300),
      homework: str(l.homework, 300),
      rating: num(l.rating) || null, // 1-5 lesson rating = the only "grade" that exists in the app
      notes: str(l.notes, 500),
      strengths: str(l.strengths, 300),
      challenges: str(l.challenges, 300),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 60);

  const paused = input.student.status === 'paused' || input.student.status === 'archived';
  const schedule = paused
    ? []
    : [
        ...input.schedules.map((s) => ({
          day: num(s.dayOfWeek),
          time: str(s.time, 5),
          duration: num(s.duration) || 60,
          subject: str(input.student.subject, 60),
        })),
        ...input.groupSlots.map((g) => ({
          day: num(g.day),
          time: str(g.time, 5),
          duration: num(g.duration) || 60,
          subject: str(g.groupName, 80) || str(input.student.subject, 60),
        })),
      ].sort((a, b) => a.day - b.day || (a.time < b.time ? -1 : 1));

  const library = input.library.slice(0, 50).map((i) => ({
    id: str(i.id, 60),
    title: str(i.title, 200),
    type: str(i.type, 30),
    subject: str(i.subject, 60),
    // Links (e.g. a video URL) are shown as a link; text is shortened. File bytes are never sent.
    content: str(i.content, 4000),
    fileName: str(i.fileName, 200),
  }));

  const view: Record<string, unknown> = {
    teacherName: str(input.teacherName, 80),
    student: {
      name: str(input.student.name, 100),
      subject: str(input.student.subject, 60),
      status: input.student.status === 'paused' || input.student.status === 'archived' ? input.student.status : 'active',
    },
    attendance,
    attendanceSummary: summary,
    lessons,
    schedule,
    library,
    finance: null,
  };

  if (input.showFinance) {
    view.finance = {
      pendingDues: num(input.student.pendingDues),
      months: input.payments
        .map((p) => ({
          month: str(p.month, 7),
          status: p.status === 'paid' || p.status === 'partial' ? p.status : 'unpaid',
          amountPaid: num(p.amountPaid),
          amountDue: num(p.amountDue),
        }))
        .sort((a, b) => (a.month < b.month ? 1 : -1))
        .slice(0, 6),
    };
  }
  return view;
}
