import React, { useState } from 'react';
import { X, Check, Clock, Trash2, Edit2, DollarSign } from 'lucide-react';
import {
  addPaymentInstallment,
  removePaymentInstallment,
  setPaymentAmountDue,
  type PaymentTarget,
} from '../firebase';
import { useBackHandler } from '../services/backHandler';
import {
  MonthlyEntitlement,
  formatMoney,
  parseMoneyInput,
  validateInstallmentAmount,
  describeEntitlement,
} from '../services/billing';

/**
 * Firestore keeps the write on the device and syncs later when there is no internet, but its promise
 * only resolves once the server confirms. We wait up to 2.5s for the confirmation; after that the
 * change is already visible locally, so we report it as saved on the device instead of hanging.
 */
async function writeWithOfflineGrace(write: Promise<unknown>, onLateError: (err: unknown) => void): Promise<'synced' | 'device'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'device'>((resolve) => {
    timer = setTimeout(() => resolve('device'), 2500);
  });
  const done = write.then(() => 'synced' as const);
  try {
    const result = await Promise.race([done, timeout]);
    if (result === 'device') done.catch(onLateError);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Small status button used inside student rows                               */
/* -------------------------------------------------------------------------- */

interface PaymentChipProps {
  entitlement: MonthlyEntitlement | null;
  currency?: string;
  onClick: () => void;
  size?: 'sm' | 'md';
}

/** Shows "دفع 300 من 500" and opens the payment dialog when tapped. */
export const PaymentChip: React.FC<PaymentChipProps> = ({ entitlement, currency = 'ج.م', onClick, size = 'md' }) => {
  if (!entitlement) return null;
  const { status, paid, due } = entitlement;
  const tone =
    status === 'paid'
      ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/35'
      : status === 'partial'
      ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 hover:bg-amber-500/35'
      : 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${pad} rounded-xl font-bold border transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 ${tone}`}
      title="اضغط لتسجيل دفعة أو مراجعة الدفعات"
    >
      {status === 'paid' && <Check className="w-3 h-3 text-emerald-400" />}
      {status === 'partial' && <Clock className="w-3 h-3 text-amber-400" />}
      {status === 'unpaid' && <X className="w-3 h-3 text-rose-400" />}
      <span>
        {status === 'paid'
          ? `دفع ✅ ${formatMoney(paid)}`
          : status === 'partial'
          ? `جزئي ⏳ ${formatMoney(paid)}/${formatMoney(due)}`
          : `لم يدفع ❌ ${formatMoney(due)} ${currency}`}
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* Dialog                                                                     */
/* -------------------------------------------------------------------------- */

interface PaymentDialogProps {
  teacherId: string;
  /** Live entitlement (recomputed by the parent from the live payment records). */
  entitlement: MonthlyEntitlement;
  currency?: string;
  onClose: () => void;
  onToast?: (message: string, isError?: boolean) => void;
}

const METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'كاش' },
  { value: 'transfer', label: 'تحويل (محفظة / انستاباي)' },
];

function methodLabel(value?: string): string {
  if (!value || value === 'legacy') return '';
  return METHODS.find((m) => m.value === value)?.label || value;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  teacherId,
  entitlement,
  currency = 'ج.م',
  onClose,
  onToast,
}) => {
  useBackHandler(true, onClose, 'payment_dialog');

  const e = entitlement;
  const [amountText, setAmountText] = useState<string>(e.remaining > 0 ? String(e.remaining) : '');
  const [method, setMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [dueText, setDueText] = useState<string>(String(e.due));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const toast = (msg: string, isError = false) => {
    if (onToast) onToast(msg, isError);
  };

  const target: PaymentTarget = {
    record: e.record,
    studentId: e.studentId,
    studentName: e.studentName,
    groupId: e.groupId,
    groupName: e.groupName,
    month: e.month,
    amountDue: e.due,
  };

  const parseAmount = (text: string): number => parseMoneyInput(text);

  const lateError = (err: unknown) => {
    console.error('Payment write failed after being accepted locally:', err);
    toast('تعذر مزامنة آخر عملية دفع مع السيرفر، راجع الدفعات وحاول مرة أخرى', true);
  };

  const handleSave = async () => {
    const amount = parseAmount(amountText);
    const problem = validateInstallmentAmount(amount, e.remaining);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await writeWithOfflineGrace(
        addPaymentInstallment(teacherId, target, { amount, method, notes }),
        lateError
      );
      const left = Math.max(0, e.remaining - amount);
      const base =
        left > 0
          ? `تم تسجيل ${formatMoney(amount)} ${currency} لـ ${e.studentName} — المتبقي ${formatMoney(left)} ${currency}`
          : `تم تسجيل ${formatMoney(amount)} ${currency} لـ ${e.studentName} — الاشتراك مكتمل ✅`;
      toast(result === 'device' ? `${base} (اتحفظ على الجهاز وهيتزامن لما النت يرجع)` : base);
      onClose();
    } catch (err: any) {
      console.error('Error saving payment installment:', err);
      const msg = typeof err?.message === 'string' && !err.message.startsWith('{') ? err.message : 'تعذر حفظ الدفعة، حاول مرة أخرى';
      setError(msg);
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    setSaving(true);
    try {
      await writeWithOfflineGrace(removePaymentInstallment(teacherId, target, paymentId), lateError);
      toast('تم حذف الدفعة');
      setDeleteId(null);
    } catch (err) {
      console.error('Error deleting payment installment:', err);
      toast('تعذر حذف الدفعة، حاول مرة أخرى', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDue = async () => {
    const value = parseAmount(dueText);
    if (!Number.isFinite(value) || value < 0) {
      setError('المستحق لازم يكون رقم صحيح (صفر أو أكتر)');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await writeWithOfflineGrace(setPaymentAmountDue(teacherId, target, value), lateError);
      toast(`تم تعديل المستحق إلى ${formatMoney(value)} ${currency}`);
      setEditingDue(false);
      setAmountText('');
    } catch (err) {
      console.error('Error updating amount due:', err);
      setError('تعذر تعديل المستحق، حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  const statusColor =
    e.status === 'paid' ? 'text-emerald-300' : e.status === 'partial' ? 'text-amber-300' : 'text-rose-300';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 animate-in fade-in duration-150"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 shadow-2xl space-y-4"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-purple-900/40 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white truncate">{e.studentName || 'الطالب'}</h2>
            <p className="text-xs text-purple-300/80 mt-0.5 truncate">
              {e.groupName ? `${e.groupName} · ` : ''}اشتراك شهر {e.month}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-2.5">
            <div className="text-[10px] text-slate-400">المستحق</div>
            <div className="text-sm font-extrabold text-white">
              {formatMoney(e.due)} <span className="text-[10px] font-normal">{currency}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-2.5">
            <div className="text-[10px] text-slate-400">دفع</div>
            <div className="text-sm font-extrabold text-emerald-300">
              {formatMoney(e.paid)} <span className="text-[10px] font-normal">{currency}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-2.5">
            <div className="text-[10px] text-slate-400">المتبقي</div>
            <div className={`text-sm font-extrabold ${e.remaining > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {formatMoney(e.remaining)} <span className="text-[10px] font-normal">{currency}</span>
            </div>
          </div>
        </div>
        <p className={`text-center text-xs font-bold ${statusColor}`}>{describeEntitlement(e, currency)}</p>

        {e.isProrated && !e.record && (
          <p className="text-[11px] leading-relaxed text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
            الطالب انضم في نص الشهر، فالمستحق محسوب بنسبة الأيام الباقية ({formatMoney(e.due)} من أصل {formatMoney(e.standardFee)} {currency}). تقدر تعدّله من "تعديل المستحق".
          </p>
        )}

        {/* Edit due */}
        {editingDue ? (
          <div className="rounded-2xl border border-purple-500/30 bg-slate-950/60 p-3 space-y-2">
            <label className="text-[11px] text-slate-300 font-bold block">المستحق الجديد لهذا الشهر</label>
            <input
              type="text"
              inputMode="decimal"
              value={dueText}
              onChange={(ev) => setDueText(ev.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDue}
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 disabled:opacity-50 cursor-pointer"
              >
                حفظ المستحق
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDue(false);
                  setDueText(String(e.due));
                  setError(null);
                }}
                className="rounded-xl bg-slate-800 text-slate-300 text-xs font-bold px-4 py-2 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingDue(true);
              setDueText(String(e.due));
            }}
            className="flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200 cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
            تعديل المستحق (خصم / شهر مجاني / نسبة أيام)
          </button>
        )}

        {/* New payment */}
        {e.remaining > 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-3 space-y-2.5">
            <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              كام دفع دلوقتي؟
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amountText}
                onChange={(ev) => {
                  setAmountText(ev.target.value);
                  setError(null);
                }}
                placeholder="اكتب المبلغ"
                className="flex-1 min-w-0 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-base font-bold text-white outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => {
                  setAmountText(String(e.remaining));
                  setError(null);
                }}
                className="shrink-0 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold px-3 cursor-pointer hover:bg-emerald-600/30"
              >
                الباقي كله ({formatMoney(e.remaining)})
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={method}
                onChange={(ev) => setMethod(ev.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-700 px-2 py-2 text-xs text-white outline-none"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="ملاحظة (اختياري)"
                className="flex-1 min-w-0 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold py-2.5 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              {saving ? 'جارٍ الحفظ…' : 'تسجيل الدفعة'}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-center text-xs font-bold text-emerald-300">
            الاشتراك مكتمل لهذا الشهر ✅
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-bold text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5">
            {error}
          </p>
        )}

        {/* History */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-300">سجل الدفعات ({e.payments.length})</h3>
          {e.payments.length === 0 ? (
            <p className="text-[11px] text-slate-500">لا توجد دفعات مسجلة لهذا الشهر.</p>
          ) : (
            e.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">
                    {formatMoney(p.amount)} {currency}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {[p.date, methodLabel(p.method), p.notes].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {deleteId === p.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDelete(p.id)}
                      className="rounded-lg bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 cursor-pointer disabled:opacity-50"
                    >
                      تأكيد الحذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(null)}
                      className="rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-1 cursor-pointer"
                    >
                      لا
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteId(p.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 cursor-pointer shrink-0"
                    title="حذف هذه الدفعة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
