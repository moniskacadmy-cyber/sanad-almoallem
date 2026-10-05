import React, { useState, useEffect } from 'react';
import { Student, TeacherProfile, AbsencePolicySettings, DEFAULT_ABSENCE_POLICY, AbsenceReasonType } from '../types';
import { useBackHandler } from '../services/backHandler';
import {
  X,
  AlertTriangle,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  Copy,
  Check,
  Send,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

export interface AbsenceDetailsResult {
  isFinancialCounted: boolean;
  hasMakeupClass: boolean;
  makeupClassDate?: string | null;
  absenceReasonType: AbsenceReasonType | string;
  notes?: string;
  addMakeupToSchedule?: boolean;
  makeupSlotDetails?: {
    dayOfWeek: number;
    time: string;
    duration: number;
  };
  sendWhatsApp?: boolean;
  whatsappMessage?: string;
}

interface AbsenceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  dateStr: string; // YYYY-MM-DD
  initialAttendance: 'absent' | 'excused';
  profile: TeacherProfile;
  topic?: string;
  onConfirm: (result: AbsenceDetailsResult) => Promise<void>;
}

export const AbsenceDetailsModal: React.FC<AbsenceDetailsModalProps> = ({
  isOpen,
  onClose,
  student,
  dateStr,
  initialAttendance,
  profile,
  topic,
  onConfirm,
}) => {
  useBackHandler(isOpen, onClose, 'absence_details_modal');

  const policy: AbsencePolicySettings = profile.absencePolicy || DEFAULT_ABSENCE_POLICY;

  const [attendanceType, setAttendanceType] = useState<'absent' | 'excused'>(initialAttendance);
  const [reasonType, setReasonType] = useState<AbsenceReasonType>(
    initialAttendance === 'excused' ? 'excused_early' : 'unexcused_sudden'
  );

  // Financial option state
  const [isFinancialCounted, setIsFinancialCounted] = useState<boolean>(
    initialAttendance === 'excused' ? policy.excusedCountsFinancially : policy.unexcusedCountsFinancially
  );

  // Makeup class state
  const [hasMakeupClass, setHasMakeupClass] = useState<boolean>(
    initialAttendance === 'excused' ? policy.excusedHasMakeup : policy.unexcusedHasMakeup
  );

  const [makeupDate, setMakeupDate] = useState<string>('');
  const [makeupTime, setMakeupTime] = useState<string>('16:00');
  const [addMakeupToSchedule, setAddMakeupToSchedule] = useState<boolean>(false);
  const [absenceNotes, setAbsenceNotes] = useState<string>('');
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(!!student.whatsapp);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Update defaults when switching attendanceType
  const handleAttendanceTypeChange = (newType: 'absent' | 'excused') => {
    setAttendanceType(newType);
    if (newType === 'excused') {
      setReasonType('excused_early');
      setIsFinancialCounted(policy.excusedCountsFinancially);
      setHasMakeupClass(policy.excusedHasMakeup);
    } else {
      setReasonType('unexcused_sudden');
      setIsFinancialCounted(policy.unexcusedCountsFinancially);
      setHasMakeupClass(policy.unexcusedHasMakeup);
    }
  };

  // Format date in Arabic for display
  const formatArabicDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    } catch {
      return dateString;
    }
  };

  // Generate customized WhatsApp message text
  const generateWhatsAppMessage = () => {
    const isExcused = attendanceType === 'excused';
    const statusLabel = isExcused ? 'اعتذار مسبق عن الحصة ⚠️' : 'غياب عن موعد الحصة ❌';
    const dateFormatted = formatArabicDate(dateStr);

    let financialNote = '';
    if (isFinancialCounted) {
      financialNote = '• الجانب المالي: تم احتساب الحصة ضمن السجل المالي للمتابعة الدراسية.';
    } else {
      financialNote = '• الجانب المالي: لم يتم احتساب هذه الحصة مالياً مراعاةً للظرف والاعتذار المسبق.';
    }

    let makeupNote = '';
    if (hasMakeupClass) {
      if (makeupDate) {
        const makeupDateFormatted = formatArabicDate(makeupDate);
        makeupNote = `• الحصة التعويضية: تم تحديد موعد الحصة التعويضية بإذن الله يوم (${makeupDateFormatted}) الساعة (${makeupTime}).`;
      } else {
        makeupNote = '• الحصة التعويضية: سيتم التنسيق معكم قريباً لتحديد موعد حصة تعويضية مناسبة لضمان عدم تأخر الطالب في المنهج.';
      }
    } else {
      makeupNote = '• الحصة التعويضية: لا توجد حصة تعويضية مجدولة لهذه الحصة.';
    }

    const topicNote = topic ? `• موضوع الحصة المقرر: ${topic}\n` : '';
    const extraNotes = absenceNotes.trim() ? `• ملاحظات: ${absenceNotes.trim()}\n` : '';

    return (
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `تحية طيبة، نود إحاطتكم علماً بخصوص حصة مادة (${profile.subject}) للطالب/ـة: *${student.name}*:\n\n` +
      `📅 موعد الحصة: ${dateFormatted}\n` +
      `🎯 الحالة: ${statusLabel}\n` +
      topicNote +
      extraNotes +
      `${financialNote}\n` +
      `${makeupNote}\n\n` +
      `شاكرين ومقدرين حسن تعاونكم وحرصكم الدائم على مصلحة الطالب 🌟\n` +
      `أ. ${profile.name}`
    );
  };

  // Update WhatsApp text whenever options change
  useEffect(() => {
    setCustomWhatsAppMsg(generateWhatsAppMessage());
  }, [
    attendanceType,
    isFinancialCounted,
    hasMakeupClass,
    makeupDate,
    makeupTime,
    absenceNotes,
    reasonType,
    dateStr,
  ]);

  if (!isOpen) return null;

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(customWhatsAppMsg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleOpenWhatsAppDirectly = () => {
    if (!student.whatsapp) return;
    const cleanPhone = student.whatsapp.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(customWhatsAppMsg)}`;
    window.open(url, '_blank');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let makeupSlotDetails: { dayOfWeek: number; time: string; duration: number } | undefined;

      if (hasMakeupClass && makeupDate) {
        const makeupD = new Date(makeupDate);
        makeupSlotDetails = {
          dayOfWeek: makeupD.getDay(),
          time: makeupTime || '16:00',
          duration: 60,
        };
      }

      await onConfirm({
        isFinancialCounted,
        hasMakeupClass,
        makeupClassDate: hasMakeupClass && makeupDate ? `${makeupDate} ${makeupTime}` : null,
        absenceReasonType: reasonType,
        notes: absenceNotes.trim(),
        addMakeupToSchedule: hasMakeupClass && addMakeupToSchedule && !!makeupDate,
        makeupSlotDetails,
        sendWhatsApp,
        whatsappMessage: customWhatsAppMsg,
      });

      if (sendWhatsApp && student.whatsapp) {
        handleOpenWhatsAppDirectly();
      }

      onClose();
    } catch (err) {
      console.error('Error confirming absence details:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shadow ${
              attendanceType === 'excused'
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>إدارة الحصة المفقودة</span>
                <span className="text-xs font-normal text-purple-300">({student.name})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                تحديد المعاملة المالية وجدولة التعويض وتوليد إشعار ولي الأمر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Smart Attendance Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 block">
              حالة عدم حضور الطالب:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAttendanceTypeChange('excused')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold border transition cursor-pointer ${
                  attendanceType === 'excused'
                    ? 'bg-amber-950/50 border-amber-500 text-amber-300 shadow-md shadow-amber-950/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>معتذر مسبقاً ⚠️</span>
              </button>

              <button
                type="button"
                onClick={() => handleAttendanceTypeChange('absent')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold border transition cursor-pointer ${
                  attendanceType === 'absent'
                    ? 'bg-rose-950/50 border-rose-500 text-rose-300 shadow-md shadow-rose-950/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>غياب مفاجئ بدون إشعار ❌</span>
              </button>
            </div>
          </div>

          {/* Reason Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              تصنيف سبب عدم الحضور:
            </label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as AbsenceReasonType)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
            >
              <option value="excused_early">اعتذار مسبق بوقت كافٍ ⏱️</option>
              <option value="unexcused_sudden">غياب مفاجئ / لم يحضر الطالب ❌</option>
              <option value="emergency">ظرف طارئ أو عائلي 🚨</option>
              <option value="illness">عذر مرضي / صحي 🏥</option>
              <option value="travel">سفر أو إجازة ✈️</option>
              <option value="other">سبب آخر 📝</option>
            </select>
          </div>

          {/* 1. الجانب المالي (Financial Counting) */}
          <div className="rounded-2xl bg-slate-950/80 border border-purple-500/25 p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>أ) الإدارة المالية: هل تُحسب هذه الحصة مالياً؟</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isFinancialCounted
                  ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}>
                {isFinancialCounted ? 'مُحتسبة 💰' : 'مُستبعدة 🚫'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              إذا تم احتسابها، ستُضاف قيمتها لمستحقات الطالب وتظهر في الفواتير (أو تُخصم من رصيد الحصص المدفوعة).
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFinancialCounted(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold border transition cursor-pointer text-xs ${
                  isFinancialCounted
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>نعم، تُحسب مالياً 💰</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFinancialCounted(false)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold border transition cursor-pointer text-xs ${
                  !isFinancialCounted
                    ? 'bg-rose-600/25 border-rose-500 text-rose-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>لا، تُستبعد من الحساب 🚫</span>
              </button>
            </div>
          </div>

          {/* 2. الحصة التعويضية (Makeup Class) */}
          <div className="rounded-2xl bg-slate-950/80 border border-indigo-500/25 p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>ب) الحصة التعويضية: هل سيتم جدولة حصة تعويضية؟</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasMakeupClass
                  ? 'bg-indigo-950 border border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}>
                {hasMakeupClass ? 'يوجد تعويض 🔄' : 'بدون تعويض ⛔'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHasMakeupClass(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold border transition cursor-pointer text-xs ${
                  hasMakeupClass
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>نعم، يوجد تعويض 🔄</span>
              </button>

              <button
                type="button"
                onClick={() => setHasMakeupClass(false)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold border transition cursor-pointer text-xs ${
                  !hasMakeupClass
                    ? 'bg-slate-800 border-slate-600 text-slate-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>لا يوجد تعويض ⛔</span>
              </button>
            </div>

            {/* Makeup Scheduling Fields if hasMakeupClass */}
            {hasMakeupClass && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      تاريخ التعويض (اختياري):
                    </label>
                    <input
                      type="date"
                      value={makeupDate}
                      onChange={(e) => setMakeupDate(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      الوقت المقترح:
                    </label>
                    <input
                      type="time"
                      value={makeupTime}
                      onChange={(e) => setMakeupTime(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {makeupDate && (
                  <label className="flex items-center gap-2 text-[11px] text-purple-200 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={addMakeupToSchedule}
                      onChange={(e) => setAddMakeupToSchedule(e.target.checked)}
                      className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                    />
                    <span>إضافة هذا الموعد التعويضي كحصة إضافية في جدول المواعيد</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 block">
              ملاحظات إضافية عن سبب الغياب:
            </label>
            <input
              type="text"
              value={absenceNotes}
              onChange={(e) => setAbsenceNotes(e.target.value)}
              placeholder="مثال: أبلغ ولي الأمر صباح اليوم باعتذار لوجود وعكة صحية..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* 3. رسالة الواتساب الجاهزة (WhatsApp Automation) */}
          <div className="rounded-2xl bg-slate-950 border border-emerald-500/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <MessageCircle className="w-4 h-4" />
                <span>إشعار واتساب التلقائي لولي الأمر:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                >
                  {copiedMsg ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>

                {student.whatsapp && (
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppDirectly}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/40 hover:bg-emerald-900 text-emerald-300 text-[10px] font-semibold transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>إرسال الآن</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={5}
              value={customWhatsAppMsg}
              onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
              className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 text-[11px] text-slate-200 leading-relaxed font-sans focus:outline-none focus:border-emerald-500/60"
            />

            {student.whatsapp ? (
              <label className="flex items-center gap-2 text-[11px] text-emerald-300/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>فتح واتساب تلقائياً للإرسال إلى ({student.whatsapp}) فور تأكيد الحفظ</span>
              </label>
            ) : (
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>لم يتم تسجيل رقم واتساب لهذا الطالب. يمكنك نسخ نص الرسالة يدوياً.</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'جارٍ حفظ الحصة...' : 'تأكيد وحفظ حالة الحصة'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
