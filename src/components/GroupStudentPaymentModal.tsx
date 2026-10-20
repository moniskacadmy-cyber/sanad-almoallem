import React, { useState, useEffect, useMemo } from 'react';
import { Student, Group, PaymentStatus, StudentPaymentRecord } from '../types';
import { recordStudentPayment, subscribeToMonthlyPayments, getPaymentRecordId } from '../firebase';
import { useBackHandler } from '../services/backHandler';
import { X, Check, Clock, AlertCircle } from 'lucide-react';

interface GroupStudentPaymentModalProps {
  group: Group;
  students: Student[];
  teacherId: string;
  currency?: string;
  onClose: () => void;
}

export const GroupStudentPaymentModal: React.FC<GroupStudentPaymentModalProps> = ({
  group,
  students,
  teacherId,
  currency = 'ج.م',
  onClose,
}) => {
  useBackHandler(true, onClose, 'group_student_payment_modal');

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, StudentPaymentRecord>>({});
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId || !group.id) return;
    const unsub = subscribeToMonthlyPayments(teacherId, currentMonth, (records) => {
      const map: Record<string, StudentPaymentRecord> = {};
      records.forEach((r) => {
        if (r.groupId === group.id) {
          map[r.studentId] = r;
        }
      });
      setPaymentsMap(map);
    });
    return () => unsub();
  }, [teacherId, group.id, currentMonth]);

  const handleTogglePayment = async (student: Student) => {
    const rec = paymentsMap[student.id];
    const currentStatus: PaymentStatus = rec?.status || (student.paymentStatus as PaymentStatus) || 'unpaid';
    const nextStatus: PaymentStatus =
      currentStatus === 'unpaid' ? 'paid' : currentStatus === 'paid' ? 'partial' : 'unpaid';
    const fee = group.monthlyFee || 0;
    const amountPaid = nextStatus === 'paid' ? fee : nextStatus === 'partial' ? Math.round(fee / 2) : 0;

    setLoadingStudentId(student.id);

    // Optimistic UI update
    setPaymentsMap((prev) => ({
      ...prev,
      [student.id]: {
        id: getPaymentRecordId(student.id, group.id, currentMonth),
        studentId: student.id,
        studentName: student.name,
        groupId: group.id,
        groupName: group.name,
        month: currentMonth,
        status: nextStatus,
        amountPaid,
        amountDue: fee,
      },
    }));

    try {
      await recordStudentPayment(teacherId, {
        studentId: student.id,
        studentName: student.name,
        groupId: group.id,
        groupName: group.name,
        month: currentMonth,
        status: nextStatus,
        amountPaid,
        amountDue: fee,
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setLoadingStudentId(null);
    }
  };

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
              حالة اشتراك شهر {currentMonth}: {group.name}
            </h2>
            <p className="text-xs text-purple-300/70 mt-0.5">
              سعر الاشتراك الشهري: {group.monthlyFee} {currency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Students Payment List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {students.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              لا يوجد طلاب مسجلين في هذه المجموعة حالياً.
            </div>
          ) : (
            students.map((student) => {
              const rec = paymentsMap[student.id];
              const status: PaymentStatus = rec?.status || (student.paymentStatus as PaymentStatus) || 'unpaid';
              const isLoading = loadingStudentId === student.id;

              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/30 transition"
                >
                  <div className="min-w-0 pr-1">
                    <span className="text-xs font-bold text-white block truncate">{student.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {status === 'paid'
                        ? `تم تحصيل: ${group.monthlyFee} ${currency}`
                        : status === 'partial'
                        ? `تحصيل جزئي: ${Math.round(group.monthlyFee / 2)} ${currency}`
                        : `المتبقي: ${group.monthlyFee} ${currency}`}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTogglePayment(student)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
                      status === 'paid'
                        ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/35'
                        : status === 'partial'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 hover:bg-amber-500/35'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-950/60'
                    }`}
                    title="اضغط للتبديل السريع بين: دفع / جزئي / لم يدفع"
                  >
                    {status === 'paid' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    {status === 'partial' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                    {status === 'unpaid' && <X className="w-3.5 h-3.5 text-rose-400" />}
                    <span>
                      {status === 'paid' ? 'دفع ✅' : status === 'partial' ? 'جزئي ⏳' : 'لم يدفع ❌'}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-purple-900/30 text-[11px] text-slate-400 flex items-center justify-between">
          <span>اضغط على الزر بجانب الطالب لتبديل حالة الدفع</span>
          <span className="text-purple-300 font-bold">
            {students.filter((st) => (paymentsMap[st.id]?.status || st.paymentStatus) === 'paid').length} / {students.length} دفعوا
          </span>
        </div>
      </div>
    </div>
  );
};
