import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, BookOpen, ChevronDown } from 'lucide-react';

interface LessonFeedbackFormProps {
  initialStrengths?: string;
  initialChallenges?: string;
  initialHomework?: string;
  onSave: (data: { strengths: string; challenges: string; homework: string }) => void;
}

export const LessonFeedbackForm: React.FC<LessonFeedbackFormProps> = ({
  initialStrengths = '',
  initialChallenges = '',
  initialHomework = '',
  onSave,
}) => {
  const [strengths, setStrengths] = useState(initialStrengths);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [homework, setHomework] = useState(initialHomework);
  const [open, setOpen] = useState(false);
  const filled = [strengths, challenges, homework].some((v) => v.trim());

  // Sync to the parent live, so nothing is lost even if the section is collapsed when saving.
  useEffect(() => {
    onSave({ strengths, challenges, homework });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strengths, challenges, homework]);

  return (
    <div className="bg-slate-950 rounded-2xl border border-purple-500/20" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 p-3 text-right cursor-pointer"
      >
        <span className="text-sm font-bold text-white">
          تقييم الحصة وملاحظات إضافية <span className="text-[10px] font-normal text-slate-500">(اختياري)</span>
          {filled && <span className="mr-2 text-[10px] text-emerald-400">● تمت الكتابة</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={open ? 'space-y-4 px-4 pb-4' : 'hidden'}>
        <div className="space-y-2">
          <label className="block text-xs text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> نقاط القوة
          </label>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            rows={2}
            placeholder="ما الذي أبدع فيه الطالب اليوم؟"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> التحديات
          </label>
          <textarea
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            rows={2}
            placeholder="ما الصعوبات التي واجهها الطالب؟"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> الواجب المنزلي
          </label>
          <textarea
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white"
            rows={2}
            placeholder="حدد الواجب المطلوب..."
          />
        </div>
      </div>
    </div>
  );
};
