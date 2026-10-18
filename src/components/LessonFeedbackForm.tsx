import React, { useState } from 'react';
import { Sparkles, Target, AlertTriangle, BookOpen } from 'lucide-react';

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

  return (
    <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-purple-500/20" dir="rtl">
      <h4 className="text-sm font-bold text-white mb-3">تقييم الحصة وملاحظات إضافية</h4>
      
      <div className="space-y-3">
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

      <div className="space-y-3">
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

      <div className="space-y-3">
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

      <button
        onClick={() => onSave({ strengths, challenges, homework })}
        className="w-full py-2.5 mt-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition"
      >
        حفظ التقييم والملاحظات
      </button>
    </div>
  );
};
