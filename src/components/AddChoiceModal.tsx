import React from 'react';
import { User, Users, X, Sparkles, Plus } from 'lucide-react';

interface AddChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIndividual: () => void;
  onSelectGroup: () => void;
}

export const AddChoiceModal: React.FC<AddChoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectIndividual,
  onSelectGroup,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-5 shadow-2xl relative space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <Plus className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">إضافة جديدة</h3>
              <p className="text-[11px] text-purple-300/70">اختر ما ترغب في إنشائه الآن</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The 2 Big Selection Cards */}
        <div className="grid grid-cols-1 gap-3 py-1">
          {/* Group Card */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectGroup();
            }}
            className="group relative flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/40 hover:border-purple-400 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-right shadow-lg shadow-purple-950/20"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/40 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                  مجموعة جديدة (سنتر)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  جديد ✨
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                إنشاء مجموعة لسنتر محدد، بمواعيد أسبوعية، وسعر اشتراك شهري ثابت.
              </p>
            </div>
          </button>

          {/* Individual Student Card */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectIndividual();
            }}
            className="group relative flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-right shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
                طالب فردي (خاص / منزلي / أونلاين)
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                إضافة طالب درس خصوصي فردي بحساب الحصة أو باقة مدفوعة.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
