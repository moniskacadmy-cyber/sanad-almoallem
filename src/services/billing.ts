/**
 * Billing helpers — the single source of truth for monthly group fees.
 *
 * Rules (agreed with the teacher):
 *  - A student in a group pays a FIXED monthly fee. Attendance / absence never changes it.
 *  - A student who joins a group in the middle of a month pays pro-rata by days for that
 *    first month (the teacher can still edit the due amount by hand).
 *  - The amount paid is ALWAYS the sum of the recorded installments; the status
 *    (unpaid / partial / paid) is derived from "paid vs due", never stored as a free flag.
 *  - Months are Cairo-time months (so the 1st of a month does not flip at 3 AM local time).
 *
 * This file is dependency-free (type imports only) so it can be unit-tested with plain Node.
 */
import type { PaymentItem, PaymentStatus, StudentPaymentRecord } from '../types';

export const APP_TIME_ZONE = 'Africa/Cairo';

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** YYYY-MM-DD of the given instant in the app time zone (Cairo). */
export function getDateKey(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** YYYY-MM of the given instant in the app time zone (Cairo). */
export function getMonthKey(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  return getDateKey(date, timeZone).substring(0, 7);
}

export function getDaysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** All month keys from `startKey` to `endKey` inclusive (ascending). */
export function getMonthKeysBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  if (!startKey || !endKey || startKey > endKey) return out;
  let [y, m] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

/** Converts Firestore Timestamp / Date / ISO string / millis / {seconds} to a Date (or null). */
export function toDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') {
      const d = new Date(value.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Display helper: 500 -> "500", 12.5 -> "12.5" (no trailing zeros). */
export function formatMoney(n: number): string {
  return String(roundMoney(n));
}

/**
 * Reads an amount typed by the teacher: accepts Arabic-Indic digits (٣٠٠), "300.5", "300,5"
 * and thousands separators ("1,500" / "1٬500"). Returns NaN when it is not a number.
 */
export function parseMoneyInput(text: string): number {
  if (typeof text !== 'string') return NaN;
  let t = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, '')
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
  if (!t) return NaN;
  t = t.replace(/,(?=\d{3}(?!\d))/g, ''); // thousands separators
  t = t.replace(',', '.'); // decimal comma
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/* -------------------------------------------------------------------------- */
/* Status & installments                                                      */
/* -------------------------------------------------------------------------- */

const EPS = 0.005;

/** Status is derived: nothing owed => paid; nothing paid => unpaid; otherwise partial/paid. */
export function computePaymentStatus(due: number, paid: number): PaymentStatus {
  const d = roundMoney(due);
  const p = roundMoney(paid);
  if (d <= EPS) return 'paid';
  if (p <= EPS) return 'unpaid';
  if (p + EPS >= d) return 'paid';
  return 'partial';
}

/** Installments of a record. Old records (before installments existed) only had `amountPaid`. */
export function getRecordPayments(record?: Partial<StudentPaymentRecord> | null): PaymentItem[] {
  if (!record) return [];
  if (Array.isArray(record.payments) && record.payments.length > 0) {
    return record.payments.filter((p) => p && Number.isFinite(Number(p.amount)));
  }
  const legacyPaid = Number(record.amountPaid);
  if (Number.isFinite(legacyPaid) && legacyPaid > 0) {
    return [
      {
        id: 'legacy',
        amount: roundMoney(legacyPaid),
        date: '',
        method: 'legacy',
        notes: 'دفعة مسجلة قبل تحديث نظام الدفعات',
      },
    ];
  }
  return [];
}

export function sumPayments(payments: PaymentItem[]): number {
  return roundMoney(payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
}

export function getRecordPaid(record?: Partial<StudentPaymentRecord> | null): number {
  return sumPayments(getRecordPayments(record));
}

/** Returns an Arabic error message when the amount is not acceptable, otherwise null. */
export function validateInstallmentAmount(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount)) return 'اكتب المبلغ بالأرقام';
  if (amount <= 0) return 'المبلغ لازم يكون أكبر من صفر';
  if (amount > roundMoney(remaining) + EPS) {
    return `المبلغ أكبر من المتبقي (${formatMoney(remaining)})`;
  }
  return null;
}

export function newPaymentId(): string {
  const c: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newPaymentItem(
  amount: number,
  opts: { date?: string; method?: string; notes?: string; id?: string } = {}
): PaymentItem {
  const item: PaymentItem = {
    id: opts.id || newPaymentId(),
    amount: roundMoney(amount),
    date: opts.date || getDateKey(),
  };
  if (opts.method) item.method = opts.method;
  if (opts.notes && opts.notes.trim()) item.notes = opts.notes.trim();
  return item;
}

/** The fields we persist on a payment record; status and amountPaid are always derived. */
export function buildPaymentFields(
  due: number,
  payments: PaymentItem[]
): { amountDue: number; amountPaid: number; status: PaymentStatus; payments: PaymentItem[] } {
  const amountDue = roundMoney(Math.max(0, due));
  const amountPaid = sumPayments(payments);
  return {
    amountDue,
    amountPaid,
    status: computePaymentStatus(amountDue, amountPaid),
    payments,
  };
}

/* -------------------------------------------------------------------------- */
/* Fees                                                                       */
/* -------------------------------------------------------------------------- */

/** Fee for one student in one group: the student's own custom fee wins over the group fee. */
export function getStudentGroupFee(
  student: { customFees?: Record<string, number> } | null | undefined,
  group: { id: string; monthlyFee?: number } | null | undefined
): number {
  if (!group) return 0;
  const custom = student?.customFees?.[group.id];
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 0) return custom;
  const fee = Number(group.monthlyFee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

/**
 * Pro-rata fee for the first month of a membership.
 * Joined on day D of a month with N days => fee * (N - D + 1) / N.
 * Any other month (or unknown join date) => the full fee.
 */
export function prorateMonthlyFee(
  fee: number,
  joinedAt: Date | null | undefined,
  monthKey: string,
  timeZone: string = APP_TIME_ZONE
): number {
  const base = roundMoney(fee);
  if (!joinedAt || base <= 0) return base;
  const joinKey = getDateKey(joinedAt, timeZone);
  if (joinKey.substring(0, 7) !== monthKey) return base;
  const day = Number(joinKey.substring(8, 10));
  const dim = getDaysInMonth(monthKey);
  const remainingDays = Math.max(1, dim - day + 1);
  return Math.round((base * remainingDays) / dim);
}

/* -------------------------------------------------------------------------- */
/* Entitlements (what a student owes in a month, per group)                   */
/* -------------------------------------------------------------------------- */

export function getPaymentRecordId(
  studentId: string,
  groupId: string | null | undefined,
  month: string
): string {
  const gId = groupId && groupId.trim() ? groupId.trim() : 'individual';
  return `${studentId}_${gId}_${month}`;
}

export interface MonthlyEntitlement {
  key: string; // payment record id
  studentId: string;
  studentName: string;
  groupId: string; // 'individual' when the fee is not tied to a group
  groupName: string;
  month: string;
  standardFee: number; // full monthly fee for this student in this group
  suggestedDue: number; // pro-rata when the student joined mid-month
  isProrated: boolean;
  due: number; // what is actually owed (record value wins when it exists)
  paid: number;
  remaining: number;
  status: PaymentStatus;
  payments: PaymentItem[];
  record: StudentPaymentRecord | null;
}

export interface EntitlementInput {
  studentId: string;
  studentName?: string;
  groupId?: string | null;
  groupName?: string;
  standardFee: number;
  monthKey: string;
  joinedAt?: Date | null;
  record?: StudentPaymentRecord | null;
}

export function buildEntitlement(input: EntitlementInput): MonthlyEntitlement {
  const groupId = input.groupId && input.groupId.trim() ? input.groupId.trim() : 'individual';
  const standardFee = roundMoney(Math.max(0, input.standardFee || 0));
  const suggestedDue = prorateMonthlyFee(standardFee, input.joinedAt, input.monthKey);
  const record = input.record || null;
  const recordDue = record ? Number(record.amountDue) : NaN;
  const due = roundMoney(Number.isFinite(recordDue) ? recordDue : suggestedDue);
  const payments = getRecordPayments(record);
  const paid = sumPayments(payments);
  return {
    key: getPaymentRecordId(input.studentId, groupId, input.monthKey),
    studentId: input.studentId,
    studentName: input.studentName || record?.studentName || '',
    groupId,
    groupName: input.groupName || record?.groupName || '',
    month: input.monthKey,
    standardFee,
    suggestedDue,
    isProrated: suggestedDue !== standardFee,
    due,
    paid,
    remaining: roundMoney(Math.max(0, due - paid)),
    status: computePaymentStatus(due, paid),
    payments,
    record,
  };
}

interface StudentLike {
  id: string;
  name?: string;
  groupIds?: string[];
  customFees?: Record<string, number>;
  billingType?: string;
  classType?: string;
  monthlyFee?: number;
}

interface GroupLike {
  id: string;
  name?: string;
  monthlyFee?: number;
  archived?: boolean;
}

interface MembershipLike {
  studentId: string;
  groupId: string | null;
  joinedAt?: any;
  leftAt?: any;
  active?: boolean;
}

/** Is this membership relevant for the given month? (joined on/before it, not left before it) */
export function isMembershipActiveInMonth(m: MembershipLike, monthKey: string): boolean {
  const joined = toDate(m.joinedAt);
  if (joined && getMonthKey(joined) > monthKey) return false;
  const left = toDate(m.leftAt);
  if (left) return monthKey <= getMonthKey(left);
  // No leave date: trust the active flag; unknown flag counts as active.
  return m.active !== false;
}

/** Student whose fee is a fixed monthly subscription (group / center students). */
export function isMonthlyStudent(student: StudentLike | null | undefined): boolean {
  if (!student) return false;
  if (student.billingType === 'monthly') return true;
  if (student.billingType === 'hourly') return false;
  return (student.groupIds && student.groupIds.length > 0) || student.classType === 'center';
}

/** All the monthly amounts a student owes in `monthKey`, one entry per group. */
export function getStudentMonthEntitlements(args: {
  student: StudentLike;
  groups: GroupLike[];
  memberships?: MembershipLike[];
  records: StudentPaymentRecord[];
  monthKey: string;
}): MonthlyEntitlement[] {
  const { student, groups, monthKey } = args;
  const memberships = (args.memberships || []).filter((m) => m.studentId === student.id);
  const recordsByGroup = new Map<string, StudentPaymentRecord>();
  args.records.forEach((r) => {
    if (r.studentId === student.id && r.month === monthKey) {
      recordsByGroup.set(r.groupId || 'individual', r);
    }
  });

  // Which groups does the student belong to in this month?
  const groupIds: string[] = [];
  const addId = (id: string | null | undefined) => {
    if (id && !groupIds.includes(id)) groupIds.push(id);
  };

  if (memberships.length > 0) {
    memberships.forEach((m) => {
      if (m.groupId && isMembershipActiveInMonth(m, monthKey)) addId(m.groupId);
    });
  } else {
    (student.groupIds || []).forEach(addId); // legacy students without membership documents
  }
  recordsByGroup.forEach((_r, gId) => addId(gId));

  const out: MonthlyEntitlement[] = [];
  groupIds.forEach((gId) => {
    const record = recordsByGroup.get(gId) || null;

    if (gId === 'individual') {
      if (record) {
        out.push(
          buildEntitlement({
            studentId: student.id,
            studentName: student.name,
            groupId: 'individual',
            groupName: record.groupName || 'اشتراك شهري',
            standardFee: record.amountDue || 0,
            monthKey,
            record,
          })
        );
      }
      return;
    }

    const group = groups.find((g) => g.id === gId);
    if (!group && !record) return;
    if (group?.archived && !record) return;

    const joinedDates = memberships
      .filter((m) => m.groupId === gId)
      .map((m) => toDate(m.joinedAt))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());

    out.push(
      buildEntitlement({
        studentId: student.id,
        studentName: student.name,
        groupId: gId,
        groupName: group?.name || record?.groupName || '',
        standardFee: group ? getStudentGroupFee(student, group) : record?.amountDue || 0,
        monthKey,
        joinedAt: joinedDates[0] || null,
        record,
      })
    );
  });

  // Legacy: a monthly student with a personal monthly fee but no group at all.
  if (out.length === 0 && isMonthlyStudent(student) && (student.groupIds || []).length === 0) {
    const fee = Number(student.monthlyFee);
    if (Number.isFinite(fee) && fee > 0) {
      out.push(
        buildEntitlement({
          studentId: student.id,
          studentName: student.name,
          groupId: 'individual',
          groupName: 'اشتراك شهري',
          standardFee: fee,
          monthKey,
          record: recordsByGroup.get('individual') || null,
        })
      );
    }
  }

  return out;
}

export interface EntitlementSummary {
  due: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
  hasEntitlements: boolean;
}

export function summarizeEntitlements(list: MonthlyEntitlement[]): EntitlementSummary {
  const due = roundMoney(list.reduce((a, e) => a + e.due, 0));
  const paid = roundMoney(list.reduce((a, e) => a + e.paid, 0));
  return {
    due,
    paid,
    remaining: roundMoney(Math.max(0, due - paid)),
    status: computePaymentStatus(due, paid),
    hasEntitlements: list.length > 0,
  };
}

/** Short text such as "دفع 300 من 500 — المتبقي 200". */
export function describeEntitlement(e: Pick<MonthlyEntitlement, 'due' | 'paid' | 'remaining' | 'status'>, currency = 'ج.م'): string {
  if (e.status === 'paid') return `دفع كامل ${formatMoney(e.paid)} ${currency}`;
  if (e.status === 'partial') {
    return `دفع ${formatMoney(e.paid)} من ${formatMoney(e.due)} — المتبقي ${formatMoney(e.remaining)} ${currency}`;
  }
  return `لم يدفع — المستحق ${formatMoney(e.due)} ${currency}`;
}
