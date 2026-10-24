import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMonthKey,
  getDateKey,
  getDaysInMonth,
  getMonthKeysBetween,
  computePaymentStatus,
  validateInstallmentAmount,
  buildPaymentFields,
  getRecordPayments,
  getRecordPaid,
  prorateMonthlyFee,
  getStudentGroupFee,
  buildEntitlement,
  getStudentMonthEntitlements,
  summarizeEntitlements,
  describeEntitlement,
  newPaymentItem,
  getPaymentRecordId,
  parseMoneyInput,
} from '../src/services/billing.ts';

const rec = (over: any = {}) => ({
  id: 'x',
  studentId: 's1',
  groupId: 'g1',
  month: '2026-10',
  status: 'unpaid' as const,
  amountPaid: 0,
  amountDue: 500,
  ...over,
});

test('month key follows Cairo time, not UTC', () => {
  // 2026-10-31 22:30 UTC is already 1 Nov 00:30 in Cairo (UTC+2)
  const d = new Date('2026-10-31T22:30:00Z');
  assert.equal(d.toISOString().substring(0, 7), '2026-10');
  assert.equal(getMonthKey(d), '2026-11');
  assert.equal(getDateKey(d), '2026-11-01');
});

test('days in month and month ranges', () => {
  assert.equal(getDaysInMonth('2026-02'), 28);
  assert.equal(getDaysInMonth('2028-02'), 29);
  assert.equal(getDaysInMonth('2026-10'), 31);
  assert.deepEqual(getMonthKeysBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(getMonthKeysBetween('2026-11', '2026-10'), []);
});

test('payment status is derived from paid vs due', () => {
  assert.equal(computePaymentStatus(500, 0), 'unpaid');
  assert.equal(computePaymentStatus(500, 300), 'partial');
  assert.equal(computePaymentStatus(500, 500), 'paid');
  assert.equal(computePaymentStatus(500, 700), 'paid');
  assert.equal(computePaymentStatus(0, 0), 'paid'); // nothing owed
  assert.equal(computePaymentStatus(500, 499.999), 'paid'); // rounding tolerance
});

test('partial payment records the amount, then the remainder completes it', () => {
  const first = buildPaymentFields(500, [newPaymentItem(300, { date: '2026-10-05' })]);
  assert.equal(first.amountPaid, 300);
  assert.equal(first.status, 'partial');

  const second = buildPaymentFields(500, [...first.payments, newPaymentItem(200, { date: '2026-10-12' })]);
  assert.equal(second.amountPaid, 500);
  assert.equal(second.status, 'paid');
  assert.equal(second.payments.length, 2);
});

test('installment validation', () => {
  assert.equal(validateInstallmentAmount(200, 200), null);
  assert.equal(validateInstallmentAmount(100, 200), null);
  assert.match(validateInstallmentAmount(0, 200)!, /أكبر من صفر/);
  assert.match(validateInstallmentAmount(-5, 200)!, /أكبر من صفر/);
  assert.match(validateInstallmentAmount(NaN, 200)!, /بالأرقام/);
  assert.match(validateInstallmentAmount(201, 200)!, /أكبر من المتبقي \(200\)/);
});

test('legacy record with only amountPaid still counts', () => {
  const legacy = rec({ status: 'partial', amountPaid: 250 });
  assert.equal(getRecordPaid(legacy), 250);
  assert.equal(getRecordPayments(legacy)[0].id, 'legacy');
  assert.equal(getRecordPaid(rec()), 0);
});

test('installments array wins over legacy amountPaid', () => {
  const r = rec({ amountPaid: 999, payments: [{ id: 'a', amount: 100, date: '2026-10-01' }] });
  assert.equal(getRecordPaid(r), 100);
});

test('pro-rata fee for a student who joins mid-month', () => {
  const join16 = new Date('2026-10-16T10:00:00Z');
  assert.equal(prorateMonthlyFee(500, join16, '2026-10'), Math.round((500 * 16) / 31)); // 258
  // joined on the 1st => full month
  assert.equal(prorateMonthlyFee(500, new Date('2026-10-01T10:00:00Z'), '2026-10'), 500);
  // later months are full
  assert.equal(prorateMonthlyFee(500, join16, '2026-11'), 500);
  // unknown join date => full
  assert.equal(prorateMonthlyFee(500, null, '2026-10'), 500);
  // last day of the month => one day only
  assert.equal(prorateMonthlyFee(310, new Date('2026-10-31T10:00:00Z'), '2026-10'), 10);
});

test('group fee: personal custom fee wins, student legacy monthlyFee is ignored', () => {
  const group = { id: 'g1', monthlyFee: 500 };
  assert.equal(getStudentGroupFee({}, group), 500);
  assert.equal(getStudentGroupFee({ customFees: { g1: 350 } }, group), 350);
  assert.equal(getStudentGroupFee({ customFees: { g1: 0 } }, group), 0);
  assert.equal(getStudentGroupFee({ customFees: { other: 10 } }, group), 500);
});

test('entitlement uses the recorded due, not a recomputed one', () => {
  const e = buildEntitlement({
    studentId: 's1',
    groupId: 'g1',
    standardFee: 600, // group fee changed later
    monthKey: '2026-10',
    record: rec({ amountDue: 500, payments: [{ id: 'a', amount: 200, date: '2026-10-02' }] }) as any,
  });
  assert.equal(e.due, 500);
  assert.equal(e.paid, 200);
  assert.equal(e.remaining, 300);
  assert.equal(e.status, 'partial');
  assert.equal(describeEntitlement(e), 'دفع 200 من 500 — المتبقي 300 ج.م');
});

test('a student who paid last month is NOT shown as paid this month', () => {
  const student = { id: 's1', name: 'أحمد', groupIds: ['g1'], paymentStatus: 'paid' } as any;
  const groups = [{ id: 'g1', name: 'ثالثة', monthlyFee: 500 }];
  const records = [rec({ month: '2026-10', amountPaid: 500, payments: [{ id: 'a', amount: 500, date: '2026-10-03' }] })] as any;

  const oct = summarizeEntitlements(getStudentMonthEntitlements({ student, groups, records, monthKey: '2026-10' }));
  assert.equal(oct.status, 'paid');
  const nov = summarizeEntitlements(getStudentMonthEntitlements({ student, groups, records, monthKey: '2026-11' }));
  assert.equal(nov.status, 'unpaid');
  assert.equal(nov.due, 500);
  assert.equal(nov.remaining, 500);
});

test('group student is charged the GROUP fee even if the student document holds another number', () => {
  // bulk-add used to store monthlyFee = hourlyRate (100) on the student document
  const student = { id: 's1', groupIds: ['g1'], billingType: 'monthly', monthlyFee: 100 } as any;
  const groups = [{ id: 'g1', name: 'ثالثة', monthlyFee: 500 }];
  const s = summarizeEntitlements(getStudentMonthEntitlements({ student, groups, records: [], monthKey: '2026-10' }));
  assert.equal(s.due, 500);
});

test('two groups => two separate entitlements that add up', () => {
  const student = { id: 's1', groupIds: ['g1', 'g2'] } as any;
  const groups = [
    { id: 'g1', name: 'أ', monthlyFee: 500 },
    { id: 'g2', name: 'ب', monthlyFee: 300 },
  ];
  const records = [rec({ groupId: 'g1', payments: [{ id: 'a', amount: 500, date: '2026-10-03' }], amountPaid: 500 })] as any;
  const list = getStudentMonthEntitlements({ student, groups, records, monthKey: '2026-10' });
  assert.equal(list.length, 2);
  const s = summarizeEntitlements(list);
  assert.equal(s.due, 800);
  assert.equal(s.paid, 500);
  assert.equal(s.remaining, 300);
  assert.equal(s.status, 'partial');
});

test('mid-month join is pro-rated using the membership date; earlier months do not include the group', () => {
  const student = { id: 's1', groupIds: ['g1'] } as any;
  const groups = [{ id: 'g1', name: 'أ', monthlyFee: 500 }];
  const memberships = [{ studentId: 's1', groupId: 'g1', joinedAt: new Date('2026-10-16T10:00:00Z'), active: true }];
  const oct = getStudentMonthEntitlements({ student, groups, memberships, records: [], monthKey: '2026-10' });
  assert.equal(oct.length, 1);
  assert.equal(oct[0].due, 258);
  assert.equal(oct[0].isProrated, true);
  assert.equal(oct[0].standardFee, 500);

  const sep = getStudentMonthEntitlements({ student, groups, memberships, records: [], monthKey: '2026-09' });
  assert.equal(sep.length, 0);

  const nov = getStudentMonthEntitlements({ student, groups, memberships, records: [], monthKey: '2026-11' });
  assert.equal(nov[0].due, 500);
});

test('a membership that ended before the month owes nothing for it', () => {
  const student = { id: 's1', groupIds: [] } as any;
  const groups = [{ id: 'g1', name: 'أ', monthlyFee: 500 }];
  const memberships = [
    {
      studentId: 's1',
      groupId: 'g1',
      joinedAt: new Date('2026-01-05T10:00:00Z'),
      leftAt: new Date('2026-08-20T10:00:00Z'),
      active: false,
    },
  ];
  const aug = getStudentMonthEntitlements({ student, groups, memberships, records: [], monthKey: '2026-08' });
  assert.equal(aug.length, 1); // still owes the month he left in
  const oct = getStudentMonthEntitlements({ student, groups, memberships, records: [], monthKey: '2026-10' });
  assert.equal(oct.length, 0);
});

test('archived group without a record is skipped, with a record it is kept', () => {
  const student = { id: 's1', groupIds: ['g1'] } as any;
  const groups = [{ id: 'g1', name: 'أ', monthlyFee: 500, archived: true }];
  assert.equal(getStudentMonthEntitlements({ student, groups, records: [], monthKey: '2026-10' }).length, 0);
  assert.equal(getStudentMonthEntitlements({ student, groups, records: [rec()] as any, monthKey: '2026-10' }).length, 1);
});

test('record ids are deterministic (no duplicate month records)', () => {
  assert.equal(getPaymentRecordId('s1', 'g1', '2026-10'), 's1_g1_2026-10');
  assert.equal(getPaymentRecordId('s1', '', '2026-10'), 's1_individual_2026-10');
  assert.equal(getPaymentRecordId('s1', null, '2026-10'), 's1_individual_2026-10');
});

test('amount typing: Arabic digits, decimals and thousands separators', () => {
  assert.equal(parseMoneyInput('300'), 300);
  assert.equal(parseMoneyInput('٣٠٠'), 300);
  assert.equal(parseMoneyInput(' 250.5 '), 250.5);
  assert.equal(parseMoneyInput('250,5'), 250.5);
  assert.equal(parseMoneyInput('1,500'), 1500);
  assert.equal(parseMoneyInput('١٬٥٠٠'), 1500);
  assert.ok(Number.isNaN(parseMoneyInput('')));
  assert.ok(Number.isNaN(parseMoneyInput('abc')));
  assert.ok(Number.isNaN(parseMoneyInput('12abc')));
  assert.ok(Number.isNaN(parseMoneyInput('-5')));
});
