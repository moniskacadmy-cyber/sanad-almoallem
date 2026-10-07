import React, { useState } from 'react';
import { TeacherProfile } from '../types';
import { updateTeacherProfile, addStudent, addSchedule } from '../firebase';
import { requestAndSaveFCMToken } from '../firebase';
import { requestBrowserNotificationPermission } from '../services/reminderService';
import { useBackHandler } from '../services/backHandler';
import {
  Sparkles,
  BookOpen,
  UserPlus,
  Calendar,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  DollarSign,
  Smartphone,
} from 'lucide-react';

interface QuickOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile;
  onComplete: () => void;
}

export const QuickOnboardingModal: React.FC<QuickOnboardingModalProps> = ({
  isOpen,
  onClose,
  profile,
  onComplete,
}) => {
  useBackHandler(isOpen, onClose, 'quick_onboarding_modal');

  const [step, setStep] = useState<number>(1);
  const [subject, setSubject] = useState(profile.subject || '');
  const [studentName, setStudentName] = useState('');
  const [studentWhatsapp, setStudentWhatsapp] = useState('');
  const [hourlyRate, setHourlyRate] = useState('100');
  const [scheduleDay, setScheduleDay] = useState(new Date().getDay());
  const [scheduleTime, setScheduleTime] = useState('16:00');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const markCompleted = () => {
    try {
      localStorage.setItem(`sanad_onboarding_completed_${profile.id}`, 'true');
    } catch {}
    onComplete();
    onClose();
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    try {
      await updateTeacherProfile(profile.id, { subject: subject.trim() });
      setStep(2);
    } catch (err) {
      console.warn('Onboarding step 1 error:', err);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setSaving(true);
    try {
      const rate = Number(hourlyRate) || 100;
      await addStudent(profile.id, {
        name: studentName.trim(),
        whatsapp: studentWhatsapp.trim() || '',
        subject: subject.trim() || profile.subject,
        classType: 'in_person',
        hourlyRate: rate,
        monthlyFee: rate * 4,
        remainingPaidLessons: 0,
        totalPrepaidLessons: 0,
        notes: 'تمت إضافته عبر الإعداد الأولي',
        color: 'purple',
      });
      setStep(3);
    } catch (err) {
      console.warn('Onboarding step 2 error:', err);
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addSchedule(profile.id, {
        studentName: studentName.trim() || 'طالب جديد',
        dayOfWeek: scheduleDay,
        time: scheduleTime || '16:00',
        duration: 60,
        recurrence: 'weekly',
        classType: 'in_person',
        color: 'purple',
      });
      setStep(4);
    } catch (err) {
      console.warn('Onboarding step 3 error:', err);
      setStep(4);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableNotifications = async () => {
    setSaving(true);
    try {
      await requestBrowserNotificationPermission();
      await requestAndSaveFCMToken(true);
    } catch (err) {
      console.warn('Onboarding notification permission notice:', err);
    } finally {
      setSaving(false);
      markCompleted();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 flex items-center justify-center p-3 sm:p-4 text-right" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
        {/* Header & Progress Indicator */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">إعداد سريع في دقيقة واحدة</h3>
              <p className="text-[10px] text-purple-300">الخطوة {step} من 4</p>
            </div>
          </div>
          <button
            type="button"
            onClick={markCompleted}
            className="text-xs text-slate-400 hover:text-white p-1"
          >
            تخطي
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-600 to-amber-400 h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Step 1: Subject */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="text-center space-y-1.5 py-2">
              <span className="text-3xl">👋</span>
              <h4 className="text-base font-black text-white">أهلاً بك في سند المعلم!</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                ما هي المادة الرئيسية التي تدرسها لطلابك؟
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">المادة التعليمية</label>
              <input
                type="text"
                required
                autoFocus
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: رياضيات، لغة عربية، فيزياء، لغة إنجليزية..."
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !subject.trim()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
            >
              <span>متابعة للخطوة التالية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Add First Student */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-3.5">
            <div className="space-y-1 py-1">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-purple-400" />
                <span>أضف أول طالب في قائمتك</span>
              </h4>
              <p className="text-[11px] text-slate-300">
                يمكنك إضافة وتعديل باقي الطلاب في أي وقت لاحقاً.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم الطالب *</label>
              <input
                type="text"
                required
                autoFocus
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="مثال: أحمد محمود"
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رقم واتساب ولي الأمر (اختياري)</label>
              <input
                type="tel"
                dir="ltr"
                value={studentWhatsapp}
                onChange={(e) => setStudentWhatsapp(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">سعر الساعة / الحصة ({profile.currency || 'ج.م'})</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="100"
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                رجوع
              </button>
              <button
                type="submit"
                disabled={saving || !studentName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
              >
                <span>حفظ ومتابعة</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Add First Class Schedule */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-3.5">
            <div className="space-y-1 py-1">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>أضف موعد أول حصة أسبوعية</span>
              </h4>
              <p className="text-[11px] text-slate-300">
                حدد اليوم والوقت لحصة الطالب ({studentName || 'الطالب'}).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">يوم الحصة</label>
              <select
                value={scheduleDay}
                onChange={(e) => setScheduleDay(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value={0}>الأحد</option>
                <option value={1}>الإثنين</option>
                <option value={2}>الثلاثاء</option>
                <option value={3}>الأربعاء</option>
                <option value={4}>الخميس</option>
                <option value={5}>الجمعة</option>
                <option value={6}>السبت</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">وقت الحصة</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                رجوع
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
              >
                <span>حفظ الموعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Class Reminders */}
        {step === 4 && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-white">هل ترغب في تفعيل تذكيرات الحصص؟</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                يقوم التطبيق بتنبيهك وتجهيز رسالة واتساب لولي الأمر قبل موعد الحصة بـ 15 دقيقة تلقائياً.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleEnableNotifications}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5"
              >
                <Bell className="w-4 h-4" />
                <span>تفعيل التذكيرات الفورية 🔔</span>
              </button>

              <button
                type="button"
                onClick={markCompleted}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                ليس الآن، ابدأ باستخدام التطبيق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
