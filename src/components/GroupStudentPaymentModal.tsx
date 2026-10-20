import React, { useState } from 'react';
import { Student, Group } from '../types';
import { updateStudentPaymentStatus } from '../firebase';
import { X, Check, DollarSign } from 'lucide-react';

interface GroupStudentPaymentModalProps {
  group: Group;
  students: Student[];
  teacherId: string;
  onClose: () => void;
}

export const GroupStudentPaymentModal: React.FC<GroupStudentPaymentModalProps> = ({
  group,
  students,
  teacherId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);

  const handleTogglePayment = async (student: Student, isPaid: boolean) => {
    setLoading(true);
    try {
      await updateStudentPaymentStatus(
        teacherId,
        student.id,
        isPaid,
        isPaid ? (student.monthlyFee || 0) : 0
      );
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-purple-500/30 rounded-3xl w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5 border-b border-purple-900/30 pb-3">
          <h2 className="text-lg font-bold text-white">طلاب مجموعة: {group.name}</h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          {students.map((student) => (
            <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-sm font-medium text-slate-200">{student.name}</span>
              <button
                onClick={() => handleTogglePayment(student, student.paymentStatus !== 'paid')}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  student.paymentStatus === 'paid'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {student.paymentStatus === 'paid' ? <Check className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                {student.paymentStatus === 'paid' ? 'تم الدفع' : 'لم يدفع'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
