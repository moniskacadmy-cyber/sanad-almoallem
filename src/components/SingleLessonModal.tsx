import React, { useState, useEffect } from 'react';
import { Student, TeacherProfile, ScheduleSlot } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { useBackHandler } from '../services/backHandler';
import { addLessonLog, toggleScheduleCompletedToday, updateStudent, addSchedule } from '../firebase';
import { AbsenceDetailsModal, AbsenceDetailsResult } from './AbsenceDetailsModal';
import { triggerAbsenceNotificationAndChime, getStoredReminderSettings } from '../services/reminderService';
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  BookOpen,
  Star,
  DollarSign,
  Bot,
  MessageCircle,
  Sparkles,
  Check,
  Calendar,
  Send,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface SingleLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile;
  student: Student;
  scheduleSlot?: ScheduleSlot;
  onOpenContextAi?: (student: Student, promptPreset: string) => void;
  onClassCompleted?: () => void;
}

export const SingleLessonModal: React.FC<SingleLessonModalProps> = ({
  isOpen,
  onClose,
  profile,
  student,
  scheduleSlot,
  onOpenContextAi,
  onClassCompleted,
}) => {
  useBackHandler(isOpen, onClose, 'single_lesson_modal');

  const [attendance, setAttendance] = useState<'present' | 'absent' | 'excused' | 'late'>('present');
  const [topic, setTopic] = useState('');
  const [homework, setHomework] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number>(scheduleSlot?.duration || 60);
  const [hourlyRate, setHourlyRate] = useState<number>(student.hourlyRate || 100);
  const [isSettled, setIsSettled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'main' | 'notes' | 'evaluation' | 'payment'>('main');

  // Absence modal branch
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceType, setAbsenceType] = useState<'absent' | 'excused'>('absent');

  // WhatsApp report preview
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const [editableReportText, setEditableReportText] = useState('');

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
  const currency = profile.currency || 'ج.م';
  const sessionCost = Math.round((duration / 60) * hourlyRate);

  useEffect(() => {
    if (isOpen) {
      setDuration(scheduleSlot?.duration || 60);
      setHourlyRate(student.hourlyRate || 100);
      setAttendance('present');
      setTopic('');
      setHomework('');
      setRating(5);
      setNotes('');
      setIsSettled(false);
      setActiveSection('main');
    }
  }, [isOpen, student.id, scheduleSlot?.id]);

  if (!isOpen) return null;

  const handleFinishLesson = async (sendWhatsApp: boolean) => {
    if (!topic.trim() && attendance === 'present') {
      alert('يرجى كتابة عنوان أو ما تم شرحه في الحصة.');
      return;
    }

    if (attendance === 'absent' || attendance === 'excused') {
      setAbsenceType(attendance);
      setShowAbsenceModal(true);
      return;
    }

    setSaving(true);
    try {
      const isFinanciallyCounted = true;
      await addLessonLog(profile.id, student.id, {
        date: todayStr,
        topic: topic.trim() || 'حصة تدريسية',
        homework: homework.trim(),
        attendance: attendance === 'late' ? 'present' : attendance,
        duration,
        hourlyRate,
        cost: sessionCost,
        settled: isSettled,
        rating,
        notes: notes.trim(),
        isFinancialCounted: isFinanciallyCounted,
        is_financial_counted: isFinanciallyCounted,
        hasMakeupClass: false,
        has_makeup_class: false,
      });

      if (scheduleSlot) {
        await toggleScheduleCompletedToday(profile.id, scheduleSlot.id, true);
      }

      // Decrement prepaid balance if applicable
      if (student.remainingPaidLessons !== undefined && student.remainingPaidLessons > 0) {
        await updateStudent(profile.id, student.id, {
          remainingPaidLessons: Math.max(0, student.remainingPaidLessons - 1),
        });
      }

      if (sendWhatsApp && student.whatsapp) {
        const attendanceLabel = attendance === 'late' ? 'حاضر (مع تأخير) ⏳' : 'حاضر ✅';
        const msg =
          `السلام عليكم ورحمة الله وبركاته 🌷\n` +
          `تقرير حصة اليوم - مادة ${student.subject || profile.subject}\n` +
          `الطالب/ـة: ${student.name}\n` +
          `📅 التاريخ: ${todayStr}\n` +
          `🎯 حالة الحضور: ${attendanceLabel}\n` +
          `⏱️ المدة: ${duration} دقيقة\n` +
          `📖 ما تم شرحه: ${topic.trim()}\n` +
          (homework.trim() ? `📝 الواجب المطلوب: ${homework.trim()}\n` : '') +
          `⭐ التقييم: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}\n` +
          (notes.trim() ? `💡 ملاحظة المعلم: ${notes.trim()}\n` : '') +
          `\nتحياتي وتقديري، أ. ${profile.name}`;

        setEditableReportText(msg);
        setShowWhatsAppPreview(true);
        setSaving(false);
        return;
      }

      if (onClassCompleted) onClassCompleted();
      onClose();
    } catch (err) {
      console.error('Error saving single lesson:', err);
      alert('حدث خطأ أثناء حفظ بيانات الحصة.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAbsence = async (result: AbsenceDetailsResult) => {
    const cost = result.isFinancialCounted ? sessionCost : 0;
    await addLessonLog(profile.id, student.id, {
      date: todayStr,
      topic: topic.trim() || (absenceType === 'excused' ? 'اعتذار مسبق عن موعد الحصة' : 'غياب عن موعد الحصة'),
      homework: '',
      attendance: absenceType,
      duration,
      hourlyRate,
      cost,
      settled: false,
      rating: 5,
      notes: result.notes || '',
      isFinancialCounted: result.isFinancialCounted,
      is_financial_counted: result.isFinancialCounted,
      hasMakeupClass: result.hasMakeupClass,
      has_makeup_class: result.hasMakeupClass,
      makeupClassDate: result.makeupClassDate || null,
      makeup_class_date: result.makeupClassDate || null,
      absenceReasonType: result.absenceReasonType,
      absence_reason_type: result.absenceReasonType,
    });

    if (scheduleSlot) {
      await toggleScheduleCompletedToday(profile.id, scheduleSlot.id, true);
    }

    if (result.addMakeupToSchedule && result.makeupSlotDetails) {
      await addSchedule(profile.id, {
        studentId: student.id,
        studentName: student.name,
        dayOfWeek: result.makeupSlotDetails.dayOfWeek,
        time: result.makeupSlotDetails.time,
        duration: result.makeupSlotDetails.duration,
        recurrence: 'once',
        classType: student.classType || 'in_person',
        color: 'indigo',
        notes: `حصة تعويضية (${result.absenceReasonType})`,
        isMakeup: true,
      });
    }

    const remSettings = getStoredReminderSettings();
    triggerAbsenceNotificationAndChime({
      studentName: student.name,
      attendanceType: absenceType,
      dateStr: todayStr,
      hasWhatsApp: !!student.whatsapp,
      soundEnabled: remSettings.soundEnabled,
    });

    setShowAbsenceModal(false);
    if (onClassCompleted) onClassCompleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 flex items-center justify-center p-3 sm:p-4 text-right" dir="rtl">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Play className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{student.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                  {student.subject || profile.subject}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                شاشة الحصة التفاعلية • {scheduleSlot?.time ? `الساعة ${scheduleSlot.time}` : 'حصة مباشرة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Quick Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveSection('main')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              activeSection === 'main' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>الدرس والحضور</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('evaluation')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              activeSection === 'evaluation' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>التقييم</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('payment')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
              activeSection === 'payment' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>الحساب المالي</span>
          </button>
          {onOpenContextAi && (
            <button
              type="button"
              onClick={() => onOpenContextAi(student, `ساعدني في تحضير خطة درس لمادة ${student.subject || profile.subject} للطالب ${student.name}`)}
              className="px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md active:scale-95 ml-auto"
            >
              <Bot className="w-3.5 h-3.5 text-amber-300" />
              <span>AI المساعد 🤖</span>
            </button>
          )}
        </div>

        {/* Main Body */}
        <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 text-xs text-slate-200">
          {/* Section 1: Attendance State */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <label className="block text-slate-300 font-bold">1. تسجيل الحضور:</label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setAttendance('present')}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  attendance === 'present'
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                حاضر ✅
              </button>
              <button
                type="button"
                onClick={() => setAttendance('late')}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  attendance === 'late'
                    ? 'bg-teal-600/30 border-teal-500 text-teal-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                متأخر ⏳
              </button>
              <button
                type="button"
                onClick={() => setAttendance('excused')}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  attendance === 'excused'
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                معتذر ⚠️
              </button>
              <button
                type="button"
                onClick={() => setAttendance('absent')}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  attendance === 'absent'
                    ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                غائب ❌
              </button>
            </div>
          </div>

          {/* Section 2: Lesson Topic & Homework */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-bold">2. ما تم شرحه في الدرس *</label>
                <VoiceInputButton
                  onTranscript={(text) => setTopic((prev) => (prev ? `${prev} ${text}` : text))}
                  compact
                />
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="عنوان الدرس، النقاط المشروحة، الصفحات..."
                rows={2}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">الواجب والمهام المطلوبة</label>
              <input
                type="text"
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                placeholder="تمارين الكتاب، حل مسائل، تسميع..."
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Section 3: Student Evaluation & Notes */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">3. تقييم أداء الطالب في الحصة:</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-lg transition cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-amber-300 font-bold mr-2">
                  {rating === 5 ? 'ممتاز 🌟' : rating === 4 ? 'جيد جداً ✨' : rating === 3 ? 'جيد 👍' : 'يحتاج متابعة ⚠️'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">ملاحظات المعلم ونقاط التحسين</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات حول التركيز، الاستيعاب، نمط التعلم..."
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Section 4: Financial Summary */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-teal-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-white block">الحساب المالي للحصة:</span>
              <span className="text-[11px] text-emerald-300">
                {duration} دقيقة • {sessionCost} {currency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSettled}
                  onChange={(e) => setIsSettled(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>تم الدفع الآن 💰</span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-purple-900/40 grid grid-cols-2 gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleFinishLesson(true)}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            <span>إنهاء وإرسال واتساب 💬</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleFinishLesson(false)}
            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-950/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>حفظ وإنهاء الحصة ✨</span>
          </button>
        </div>

        {/* WhatsApp Preview Modal */}
        {showWhatsAppPreview && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl text-right space-y-3.5">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>معاينة رسالة التقرير لواتساب</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowWhatsAppPreview(false);
                    if (onClassCompleted) onClassCompleted();
                    onClose();
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={8}
                value={editableReportText}
                onChange={(e) => setEditableReportText(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-emerald-500/30 p-3 text-xs text-white leading-relaxed focus:outline-none"
              />

              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/${student.whatsapp?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    editableReportText
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setShowWhatsAppPreview(false);
                    if (onClassCompleted) onClassCompleted();
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Send className="w-4 h-4" />
                  <span>فتح محادثة واتساب الآن</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Absence Details Modal */}
        {showAbsenceModal && (
          <AbsenceDetailsModal
            isOpen={showAbsenceModal}
            onClose={() => setShowAbsenceModal(false)}
            student={student}
            dateStr={todayStr}
            initialAttendance={absenceType}
            profile={profile}
            topic={topic}
            onConfirm={handleConfirmAbsence}
          />
        )}
      </div>
    </div>
  );
};
