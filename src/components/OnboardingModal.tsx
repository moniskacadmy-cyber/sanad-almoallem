import React, { useState } from 'react';
import { TeacherProfile } from '../types';
import { updateTeacherProfile } from '../firebase';

interface OnboardingModalProps {
  profile: TeacherProfile;
  onComplete: () => void;
}

const SUBJECTS = [
  'اللغة العربية', 'اللغة الإنجليزية', 'الرياضيات', 'الفيزياء', 'الكيمياء',
  'العلوم', 'الأحياء', 'التاريخ', 'الجغرافيا', 'أخرى'
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ profile, onComplete }) => {
  const [name, setName] = useState(profile.name || '');
  const [subject, setSubject] = useState(profile.subject || '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp || '');
  const [customSubject, setCustomSubject] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subject) return;

    setLoading(true);
    try {
      const finalSubject = subject === 'أخرى' ? customSubject : subject;
      await updateTeacherProfile(profile.id, {
        name,
        subject: finalSubject,
        whatsapp,
        onboardingCompleted: true,
      });
      onComplete();
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-purple-500/30 rounded-3xl w-full max-w-sm p-8 shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">أهلاً بك في سند المعلم! 👋</h2>
          <p className="text-sm text-slate-400">دعنا نعد حسابك في ثوانٍ بسيطة لنخصص التجربة لك.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">اسم المعلم</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أ. محمد أحمد"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">المادة الدراسية</label>
            <select
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="" disabled>اختر المادة</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {subject === 'أخرى' && (
              <input
                required
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="أدخل اسم المادة"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mt-2 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">رقم الواتساب (اختياري)</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name || !subject}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform active:scale-95"
        >
          {loading ? 'جاري الحفظ...' : 'ابدأ استخدام سند المعلم ✨'}
        </button>
      </form>
    </div>
  );
};
