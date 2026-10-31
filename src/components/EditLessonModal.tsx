import React, { useState, useEffect, useMemo } from 'react';
import {
  ScheduleSlot,
  Student,
  Group,
  ClassType,
  RecurrenceType,
} from '../types';
import { updateSchedule, cleanUndefined } from '../firebase';
import { hasConflict } from '../services/conflictService';
import { useBackHandler } from '../services/backHandler';
import {
  X,
  User,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  Check,
  Loader2,
  Search,
  Building2,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  schedule: ScheduleSlot | null;
  students: Student[];
  groups?: Group[];
  schedules?: ScheduleSlot[];
  onSuccess?: () => void;
}

// Time Slots list (24-hour format and 12-hour display labels)
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const period = hours < 12 ? 'ص' : 'م';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMin = minutes === 0 ? '00' : '30';
  const label = `${displayHour.toString().padStart(2, '0')}:${displayMin} ${period}`;
  return { time24, label };
});

const WEEK_DAYS = [
  { dayIndex: 6, name: 'السبت' },
  { dayIndex: 0, name: 'الأحد' },
  { dayIndex: 1, name: 'الإثنين' },
  { dayIndex: 2, name: 'الثلاثاء' },
  { dayIndex: 3, name: 'الأربعاء' },
  { dayIndex: 4, name: 'الخميس' },
  { dayIndex: 5, name: 'الجمعة' },
];

const CLASS_COLORS = [
  { id: 'cyan', name: 'أزرق سماوي', hex: '#06b6d4', bg: 'rgba(14, 165, 233, 0.28)', border: '#38bdf8', text: '#e0f2fe' },
  { id: 'emerald', name: 'أخضر زمردي', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.28)', border: '#34d399', text: '#d1fae5' },
  { id: 'amber', name: 'ذهبي / برتقالي', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.32)', border: '#fbbf24', text: '#fef3c7' },
  { id: 'purple', name: 'بنفسجي ملكي', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.28)', border: '#a78bfa', text: '#ede9fe' },
  { id: 'blue', name: 'أزرق كلاسيكي', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.28)', border: '#60a5fa', text: '#dbeafe' },
  { id: 'rose', name: 'وردي', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.28)', border: '#f472b6', text: '#fce7f3' },
  { id: 'red', name: 'أحمر قرمزي', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.28)', border: '#f87171', text: '#fee2e2' },
  { id: 'indigo', name: 'نيلي', hex: '#6366f1', bg: 'rgba(99, 102, 241, 0.28)', border: '#818cf8', text: '#e0e7ff' },
];

export const EditLessonModal: React.FC<EditLessonModalProps> = ({
  isOpen,
  onClose,
  teacherId,
  schedule,
  students,
  groups = [],
  schedules = [],
  onSuccess,
}) => {
  // Back handler for mobile back button
  useBackHandler(isOpen, onClose, 'edit_lesson_modal');

  // Selected Target (Student or Group)
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [time, setTime] = useState<string>('16:00');
  const [duration, setDuration] = useState<number>(60);
  const [classType, setClassType] = useState<ClassType>('in_person');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('weekly');
  const [color, setColor] = useState<string>('emerald');
  const [locationOrLink, setLocationOrLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // UI state
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize form state when modal opens or schedule changes
  useEffect(() => {
    if (!isOpen || !schedule) return;

    // Detect if current schedule belongs to a group
    const isGroup = schedule.id?.startsWith('group_slot_') || (schedule as any).isGroupSlot || (schedule as any).groupId;
    const initialKey = isGroup
      ? `group:${(schedule as any).groupId || schedule.studentId.replace('group_', '')}`
      : `student:${schedule.studentId}`;

    setSelectedTargetKey(initialKey);
    setSearchQuery('');
    setDayOfWeek(Number(schedule.dayOfWeek) || 0);
    setTime(schedule.time || '16:00');
    setDuration(Number(schedule.duration) || 60);
    setClassType(schedule.classType || 'in_person');
    setRecurrence(schedule.recurrence || 'weekly');
    setColor(schedule.color || 'purple');
    setLocationOrLink(schedule.locationOrLink || '');
    setNotes(schedule.notes || '');
    setConflictError(null);
  }, [isOpen, schedule]);

  // Combine and filter options for dropdown
  const filteredStudentOptions = useMemo(() => {
    const activeStudents = students.filter((s) => !s.archived);
    if (!searchQuery.trim()) return activeStudents;
    const q = searchQuery.trim().toLowerCase();
    return activeStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.subject && s.subject.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }, [students, searchQuery]);

  const filteredGroupOptions = useMemo(() => {
    const activeGroups = groups.filter((g) => !g.archived && g.status !== 'paused');
    if (!searchQuery.trim()) return activeGroups;
    const q = searchQuery.trim().toLowerCase();
    return activeGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.centerName && g.centerName.toLowerCase().includes(q)) ||
        (g.subject && g.subject.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  if (!isOpen || !schedule) return null;

  // Selected Target Metadata
  const selectedTargetMeta = (() => {
    if (!selectedTargetKey) return null;
    if (selectedTargetKey.startsWith('student:')) {
      const stId = selectedTargetKey.replace('student:', '');
      const st = students.find((s) => s.id === stId);
      return st ? { type: 'student' as const, id: st.id, name: st.name, subject: st.subject } : null;
    }
    if (selectedTargetKey.startsWith('group:')) {
      const gId = selectedTargetKey.replace('group:', '');
      const g = groups.find((grp) => grp.id === gId);
      return g ? { type: 'group' as const, id: g.id, name: `مجموعة ${g.name}`, subject: g.subject } : null;
    }
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!selectedTargetMeta) {
      setConflictError('يرجى اختيار الطالب أو المجموعة المرتبطة بالمعد');
      return;
    }

    // Conflict Check against other schedules
    if (schedules && schedules.length > 0) {
      const conflictRes = hasConflict(
        {
          id: schedule.id,
          dayOfWeek: Number(dayOfWeek),
          time,
          duration: Number(duration) || 60,
          studentName: selectedTargetMeta.name,
        },
        schedules,
        schedule.id
      );

      if (conflictRes.hasConflict) {
        setConflictError(conflictRes.message || 'عفواً، يوجد حصة أو مجموعة أخرى مسجلة في هذا التوقيت');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isGroup = selectedTargetMeta.type === 'group';

      // Build sanitized payload with cleanUndefined
      const updatesPayload = cleanUndefined({
        studentId: isGroup ? `group_${selectedTargetMeta.id}` : selectedTargetMeta.id,
        studentName: selectedTargetMeta.name,
        groupId: isGroup ? selectedTargetMeta.id : null,
        isGroupSlot: isGroup,
        dayOfWeek: Number(dayOfWeek),
        time,
        duration: Number(duration) || 60,
        recurrence,
        classType,
        color,
        locationOrLink: locationOrLink.trim() || '',
        notes: notes.trim() || '',
      });

      await updateSchedule(teacherId, schedule.id, updatesPayload);

      setToastMessage('تم تحديث موعد الحصة بنجاح! 🎉');
      setTimeout(() => {
        setToastMessage(null);
        if (onSuccess) onSuccess();
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Error updating schedule slot:', err);
      setConflictError(err.message || 'حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col animate-fadeIn transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <Calendar className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                تعديل موعد الحصة
              </h3>
              <p className="text-[11px] text-purple-300">
                تغيير الطالب، التوقيت، اليوم، ونوع الحصة بالجدول
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Conflict or Firestore Error Alert */}
          {conflictError && (
            <div className="rounded-2xl bg-rose-950/90 border border-rose-500/50 p-3.5 flex items-start gap-2.5 text-rose-200 text-xs shadow-lg animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-bold text-rose-300 mb-0.5">تنبيه تعارض المواعيد!</p>
                <p className="text-[11px] text-rose-200">{conflictError}</p>
              </div>
            </div>
          )}

          {/* Success Toast Notification */}
          {toastMessage && (
            <div className="rounded-2xl bg-emerald-950/90 border border-emerald-500/50 p-3 flex items-center gap-2 text-emerald-200 text-xs font-bold shadow-lg">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* SECTION 1: STUDENT / GROUP SELECTOR (القائمة المنسدلة لاختيار الطالب أو المجموعة) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-300" />
                <span>اختر / غير الطالب أو المجموعة المرتبطة بالمواك *</span>
              </label>
              {selectedTargetMeta && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-500/30">
                  {selectedTargetMeta.type === 'group' ? '🏫 مجموعة' : '👤 طالب فردي'}
                </span>
              )}
            </div>

            {/* Quick Search inside selector if list is long */}
            {(students.length > 5 || groups.length > 3) && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث سريع باسم الطالب أو المجموعة..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Dropdown Select with Grouping */}
            <select
              value={selectedTargetKey}
              onChange={(e) => setSelectedTargetKey(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-purple-500/40 px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition cursor-pointer leading-relaxed"
            >
              <option value="" disabled>
                -- اختر الطالب أو المجموعة --
              </option>

              {/* Group 1: Individual Students */}
              <optgroup label="👤 الطلاب الفرديين">
                {filteredStudentOptions.map((st) => (
                  <option key={`student:${st.id}`} value={`student:${st.id}`}>
                    👤 {st.name} {st.subject ? `(${st.subject})` : ''}
                  </option>
                ))}
              </optgroup>

              {/* Group 2: Educational Groups / Centers */}
              {filteredGroupOptions.length > 0 && (
                <optgroup label="🏫 المجموعات والسناتر">
                  {filteredGroupOptions.map((g) => (
                    <option key={`group:${g.id}`} value={`group:${g.id}`}>
                      🏫 مجموعة {g.name} {g.centerName ? `• سنتر: ${g.centerName}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* SECTION 2: DAY AND START TIME */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                يوم الحصة *
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                {WEEK_DAYS.map((d) => (
                  <option key={d.dayIndex} value={d.dayIndex}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                وقت البدء *
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer font-mono"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.time24} value={slot.time24}>
                    {slot.label} ({slot.time24})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION 3: DURATION, CLASS TYPE, RECURRENCE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                المدة بالدقائق
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
                <option value={60}>60 دقيقة (ساعة)</option>
                <option value={90}>90 دقيقة (ساعة ونصف)</option>
                <option value={120}>120 دقيقة (ساعتان)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                نوع الحصة
              </label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value as ClassType)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="in_person">حضور شخصي 👤</option>
                <option value="online">أونلاين 🌐</option>
                <option value="trial">حصة تجريبية ✨</option>
                <option value="center">سنتر / مجموعة 🏫</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                التكرار الأسبوعي
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="weekly">أسبوعياً</option>
                <option value="daily">يومياً</option>
                <option value="monthly">شهرياً</option>
                <option value="once">مرة واحدة</option>
              </select>
            </div>
          </div>

          {/* SECTION 4: COLOR PICKER */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              لون كارت الحصة في جدول المواعيد
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-2 rounded-2xl bg-slate-950 border border-slate-800">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                  className={`py-1.5 px-2 rounded-xl border text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition ${
                    color === c.id ? 'ring-2 ring-white shadow-lg scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  <span style={{ color: c.text }}>{c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 5: LOCATION OR LINK */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              المكان أو رابط الحصة (Zoom / Teams / العنوان)
            </label>
            <input
              type="text"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder="رابط الحصة الأونلاين أو موقع السنتر / منزل الطالب..."
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 transition"
            />
          </div>

          {/* SECTION 6: NOTES */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              ملاحظات إضافية على الموعد
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="ملاحظات حول الموعد، متطلبات الحصة، إلخ..."
              className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs text-white focus:outline-none focus:border-purple-400 transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-purple-900/30">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs transition shadow-lg shadow-purple-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>جارٍ حفظ التعديلات...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>حفظ التعديلات في جدول المواعيد</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer active:scale-98"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
