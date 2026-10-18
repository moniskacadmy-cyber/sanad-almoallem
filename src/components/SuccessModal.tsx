import React from 'react';
import { Sparkles } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, studentName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center">
        <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-6" />
        <h2 className="text-xl font-bold text-white mb-2">كده أنت بدأت تستخدم البرنامج فعليًا!</h2>
        <p className="text-sm text-slate-400 mb-8">كل حصة تسجّلها بتبني ملف كامل لـ {studentName}.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold">تمام، يلا بينا</button>
      </div>
    </div>
  );
};
