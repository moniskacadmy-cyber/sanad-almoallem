import React, { useState } from 'react';
import { Student } from '../types';
import { recordHourlyPayment } from '../firebase';

interface Props {
  teacherId: string;
  student: Student;
  dueAmount: number; // إجمالي مستحق الدورة الحالية
  currency: string;
  onClose: () => void;
  onDone?: (msg: string) => void;
}

export const HourlyPaymentDialog: React.FC<Props> = ({ teacherId, student, dueAmount, currency, onClose, onDone }) => {
  const paid = Number(student.hourlyPaidAmount) || 0;
  const remaining = Math.max(0, dueAmount - paid);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= remaining;
  const history = (student.hourlyPayments || []).slice().reverse();

  const save = async (val: number) => {
    if (busy || !(val > 0)) return;
    setBusy(true);
    try {
      await recordHourlyPayment(teacherId, student.id, val, dueAmount, note.trim());
      onDone?.(`تم تسجيل دفعة ${val} ${currency}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-end sm:items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-purple-500/30 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white">تسجيل دفعة — {student.name}</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-xl bg-slate-950 p-2"><div className="text-slate-400">المستحق</div><div className="font-bold text-white">{dueAmount}</div></div>
          <div className="rounded-xl bg-emerald-950/60 p-2"><div className="text-emerald-300">مدفوع</div><div className="font-bold text-emerald-200">{paid}</div></div>
          <div className="rounded-xl bg-rose-950/60 p-2"><div className="text-rose-300">متبقي</div><div className="font-bold text-rose-200">{remaining}</div></div>
        </div>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={remaining}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`المبلغ (حتى ${remaining} ${currency})`}
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
        />
        <div className="flex gap-2">
          <button type="button" disabled={!valid || busy} onClick={() => save(value)} className="flex-1 py-2 rounded-xl bg-amber-600 disabled:opacity-40 text-white text-xs font-bold">
            تسجيل دفعة جزئية
          </button>
          <button type="button" disabled={remaining <= 0 || busy} onClick={() => save(remaining)} className="flex-1 py-2 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold">
            سداد المتبقي ({remaining})
          </button>
        </div>
        {history.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-slate-300">
            <div className="text-slate-500">سجل الدفعات</div>
            {history.map((h) => (
              <div key={h.id} className="flex justify-between border-b border-slate-800 py-0.5">
                <span>{new Date(h.date).toLocaleDateString('ar-EG')}{h.note ? ` • ${h.note}` : ''}</span>
                <span className="font-mono text-emerald-300">{h.amount} {currency}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={onClose} className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs">إغلاق</button>
      </div>
    </div>
  );
};
