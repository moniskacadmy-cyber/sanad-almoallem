import React, { useState } from 'react';
import { DollarSign, X, Check } from 'lucide-react';
import { StudentPaymentRecord, PaymentStatus } from '../types';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  student: { id: string; name: string };
  group: { id: string; name: string };
  onSave: (paymentData: { amountPaid: number; amountDue: number; status: PaymentStatus; notes: string }) => Promise<void>;
  initialAmountDue: number;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({ isOpen, onClose, student, group, onSave, initialAmountDue }) => {
  const [amountPaid, setAmountPaid] = useState(initialAmountDue.toString());
  const [amountDue, setAmountDue] = useState(initialAmountDue.toString());
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const paid = Number(amountPaid) || 0;
    const due = Number(amountDue) || 0;
    const status: PaymentStatus = paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    
    await onSave({ amountPaid: paid, amountDue: due, status, notes });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white">تسجيل دفع يدوي</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>
        <p className="text-xs text-slate-400">{student.name} - {group.name}</p>
        
        <div>
          <label className="text-[11px] text-slate-300">المستحق كلياً</label>
          <input type="number" value={amountDue} onChange={e => setAmountDue(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1"/>
        </div>
        
        <div>
          <label className="text-[11px] text-slate-300">المبلغ المدفوع</label>
          <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1"/>
        </div>
        
        <div>
          <label className="text-[11px] text-slate-300">طريقة الدفع / ملاحظات</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="كاش، إنستاباي..." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1"/>
        </div>

        <button onClick={handleSave} disabled={isSaving} className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-xs font-bold transition">
          {isSaving ? 'جاري الحفظ...' : 'حفظ الدفعة'}
        </button>
      </div>
    </div>
  );
};
