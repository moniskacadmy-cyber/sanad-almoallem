import React, { useMemo, useState } from 'react';
import { Student, Group } from '../types';
import { useBackHandler } from '../services/backHandler';
import { useMonthlyPaymentRecords, useGroupsAndMemberships } from '../services/useBilling';
import {
  buildEntitlement,
  describeEntitlement,
  formatMoney,
  getMonthKey,
  getStudentGroupFee,
  getStudentMonthEntitlements,
  MonthlyEntitlement,
  summarizeEntitlements,
} from '../services/billing';
import { PaymentChip, PaymentDialog } from './PaymentDialog';
import { X } from 'lucide-react';

interface GroupStudentPaymentModalProps {
  group: Group;
  students: Student[];
  teacherId: string;
  currency?: string;
  onClose: () => void;
  onToast?: (message: string, isError?: boolean) => void;
}

export const GroupStudentPaymentModal: React.FC<GroupStudentPaymentModalProps> = ({
  group,
  students,
  teacherId,
  currency = 'ج.م',
  onClose,
  onToast,
}) => {
  useBackHandler(true, onClose, 'group_student_payment_modal');

  // Cairo-time month key
  const currentMonth = useMemo(() => getMonthKey(), []);
  const monthRecords = useMonthlyPaymentRecords(teacherId, currentMonth);
  const { groups, memberships } = useGroupsAndMemberships(teacherId);
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);

  const getEntitlement = (student: Student): MonthlyEntitlement => {
    const found = getStudentMonthEntitlements({
      student,
      groups: groups.length > 0 ? groups : [group],
      memberships,
      records: monthRecords,
      monthKey: currentMonth,
    }).find((e) => e.groupId === group.id);
    if (found) return found;
    return buildEntitlement({
      studentId: student.id,
      studentName: student.name,
      groupId: group.id,
      groupName: group.name,
      standardFee: getStudentGroupFee(student, group),
      monthKey: currentMonth,
      record: monthRecords.find((r) => r.studentId === student.id && r.groupId === group.id) || null,
    });
  };

  const entitlements = students.map(getEntitlement);
  const totals = summarizeEntitlements(entitlements);
  const paidCount = entitlements.filter((e) => e.status === 'paid').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl w-full max-w-md p-5 shadow-2xl relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-white">
              اشتراك شهر {currentMonth}: {group.name}
            </h2>
            <p className="text-xs text-purple-300/70 mt-0.5">
              سعر الاشتراك الشهري: {formatMoney(group.monthlyFee || 0)} {currency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Students Payment List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {students.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">لا يوجد طلاب مسجلين في هذه المجموعة حالياً.</div>
          ) : (
            students.map((student, i) => {
              const e = entitlements[i];
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/30 transition"
                >
                  <div className="min-w-0 pr-1">
                    <span className="text-xs font-bold text-white block truncate">{student.name}</span>
                    <span className="text-[10px] text-slate-400">{describeEntitlement(e, currency)}</span>
                  </div>
                  <PaymentChip entitlement={e} currency={currency} onClick={() => setPaymentStudentId(student.id)} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer totals */}
        <div className="pt-2 border-t border-purple-900/30 space-y-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>
              المحصّل: <b className="text-emerald-300">{formatMoney(totals.paid)}</b> من {formatMoney(totals.due)} {currency}
            </span>
            <span className="text-purple-300 font-bold">
              {paidCount} / {students.length} دفعوا كامل
            </span>
          </div>
          <div>
            المتبقي: <b className={totals.remaining > 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatMoney(totals.remaining)} {currency}</b>
            <span className="mr-2">· اضغط على زر الطالب لتسجيل دفعة</span>
          </div>
        </div>
      </div>

      {paymentStudentId &&
        (() => {
          const st = students.find((x) => x.id === paymentStudentId);
          if (!st) return null;
          return (
            <PaymentDialog
              teacherId={teacherId}
              entitlement={getEntitlement(st)}
              currency={currency}
              onClose={() => setPaymentStudentId(null)}
              onToast={onToast}
            />
          );
        })()}
    </div>
  );
};
