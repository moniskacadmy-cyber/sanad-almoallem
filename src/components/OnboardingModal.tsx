import React, { useState } from 'react';
import { TeacherProfile } from '../types';
import { updateTeacherProfile } from '../firebase';
import { Sparkles, BookOpen, User, Phone, CheckCircle2, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  profile: TeacherProfile;
  onComplete: () => void;
}

const SUBJECTS = [
  'اللغة العربية',
  'اللغة الإنجليزية',
  'الرياضيات',
  'العلوم',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'الدراسات الاجتماعية',
  'التاريخ',
  'الجغرافيا',
  'الفرنسية',
  'الألمانية',
  'الحاسب الآلي والبرمجة',
  'أخرى',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ profile, onComplete }) => {
  const [name, setName] = useState(profile.name || '');
  const [subject, setSubject] = useState(
    profile.subject && SUBJECTS.includes(profile.subject) ? profile.subject : profile.subject ? 'أخرى' : ''
  );
  const [customSubject, setCustomSubject] = useState(
    profile.subject && !SUBJECTS.includes(profile.subject) ? profile.subject : ''
  );
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('يرجى كتابة اسم المعلم');
      return;
    }
    const finalSubject = subject === 'أخرى' ? customSubject.trim() : subject;
    if (!finalSubject) {
      setErrorMessage('يرجى اختيار أو تحديد المادة الدراسية');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await updateTeacherProfile(profile.id, {
        name: name.trim(),
        subject: finalSubject,
        whatsapp: whatsapp.trim(),
        onboardingCompleted: true,
      });
      onComplete();
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      setErrorMessage('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await updateTeacherProfile(profile.id, {
        onboardingCompleted: true,
      });
    } catch (err) {
      console.warn('Error marking onboarding as completed:', err);
    } finally {
      setLoading(false);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-purple-500/30 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative my-auto">
        {/* Glow accent */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-3 mb-6 relative">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 border border-purple-400/30">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            أهلاً بك في <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">سند المعلم</span> 👋
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
            خطوات بسيطة لتخصيص جدولك، طلابك، وتقاريرك التعليمية حسب مادتك الدراسية.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Teacher Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-purple-400" />
              اسم المعلم / اللقب <span className="text-red-400">*</span>
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="مثال: أ. محمد أحمد"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-purple-400" />
              المادة الدراسية الأساسية <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            >
              <option value="" disabled className="text-slate-500">
                اختر المادة الدراسية...
              </option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s} className="bg-slate-900 text-white">
                  {s}
                </option>
              ))}
            </select>

            {subject === 'أخرى' && (
              <input
                required
                type="text"
                value={customSubject}
                onChange={(e) => {
                  setCustomSubject(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="اكتب اسم المادة هنا..."
                className="w-full bg-slate-800/90 border border-purple-500/40 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm mt-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-400" />
              رقم الواتساب <span className="text-slate-400 text-[10px] font-normal">(اختياري لمراسلة أولياء الأمور)</span>
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="مثال: 01012345678"
              dir="ltr"
              className="w-full text-right bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading || !name.trim() || !subject}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? (
                <span>جاري إعداد حسابك...</span>
              ) : (
                <>
                  <span>ابدأ رحلتك التعليمية الآن</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Skip Button */}
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium flex items-center justify-center gap-1.5"
            >
              <span>تخطي الآن والمتابعة للرئيسية</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
