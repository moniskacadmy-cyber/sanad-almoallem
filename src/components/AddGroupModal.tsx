import React, { useState, useMemo, useEffect } from 'react';
import { Group, EducationalCenter, GroupScheduleItem, ScheduleSlot } from '../types';
import { addGroup, addCenter, subscribeToGroups, subscribeToSchedules } from '../firebase';
import { hasConflict } from '../services/conflictService';
import { useBackHandler } from '../services/backHandler';
import {
  Users,
  X,
  Building2,
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  DollarSign,
  Palette,
  AlertCircle,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  defaultSubject?: string;
  currency?: string;
  existingCenters: EducationalCenter[];
  onGroupAdded?: (newGroupId: string) => void;
  onCenterAdded?: (newCenterName: string) => void;
}

const COMMON_SUBJECTS = [
  'القرآن الكريم',
  'اللغة العربية',
  'الرياضيات',
  'العلوم',
  'اللغة الإنجليزية',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التاريخ',
  'الجغرافيا',
  'الدراسات الاجتماعية',
  'الفرنساوي',
  'أخرى',
];

const COMMON_GRADES = [
  'الرابع الابتدائي',
  'الخامس الابتدائي',
  'السادس الابتدائي',
  'الأول الإعدادي',
  'الثاني الإعدادي',
  'الثالث الإعدادي',
  'الأول الثانوي',
  'الثاني الثانوي',
  'الثالث الثانوي',
  'جامعي',
  'عام / دورة',
];

const WEEK_DAYS = [
  { index: 6, name: 'السبت' },
  { index: 0, name: 'الأحد' },
  { index: 1, name: 'الإثنين' },
  { index: 2, name: 'الثلاثاء' },
  { index: 3, name: 'الأربعاء' },
  { index: 4, name: 'الخميس' },
  { index: 5, name: 'الجمعة' },
];

const PALETTE_COLORS = [
  '#7c3aed', // Purple
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#be185d', // Pink
];

export const AddGroupModal: React.FC<AddGroupModalProps> = ({
  isOpen,
  onClose,
  teacherId,
  defaultSubject = '',
  currency = 'ج.م',
  existingCenters,
  onGroupAdded,
  onCenterAdded,
}) => {
  useBackHandler(isOpen, onClose, 'add_group_modal');

  const [name, setName] = useState('');
  const [centerName, setCenterName] = useState('');
  const [subject, setSubject] = useState(defaultSubject || 'اللغة العربية');
  const [customSubject, setCustomSubject] = useState('');
  const [grade, setGrade] = useState('الثالث الإعدادي');
  const [monthlyFee, setMonthlyFee] = useState<string>('300');
  const [color, setColor] = useState('#7c3aed');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [notes, setNotes] = useState('');

  // Weekly schedule slots
  const [scheduleSlots, setScheduleSlots] = useState<GroupScheduleItem[]>([
    { day: 6, time: '17:00', duration: 90 },
    { day: 2, time: '17:00', duration: 90 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [existingGroups, setExistingGroups] = useState<Group[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<ScheduleSlot[]>([]);

  useEffect(() => {
    if (!isOpen || !teacherId) return;
    const unsubG = subscribeToGroups(teacherId, setExistingGroups);
    const unsubS = subscribeToSchedules(teacherId, setExistingSchedules);
    return () => {
      unsubG();
      unsubS();
    };
  }, [isOpen, teacherId]);

  // Suggested center names
  const centerSuggestions = useMemo(() => {
    return Array.from(new Set(existingCenters.map((c) => c.name.trim()))).filter(Boolean);
  }, [existingCenters]);

  if (!isOpen) return null;

  const handleAddScheduleSlot = () => {
    setScheduleSlots((prev) => [...prev, { day: 0, time: '16:00', duration: 90 }]);
  };

  const handleRemoveScheduleSlot = (index: number) => {
    setScheduleSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateScheduleSlot = (index: number, updates: Partial<GroupScheduleItem>) => {
    setScheduleSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...updates } : slot))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);
    const cleanName = name.trim();
    const cleanCenter = centerName.trim();
    const cleanSubject = subject === 'أخرى' ? customSubject.trim() : subject.trim();
    const feeNum = parseFloat(monthlyFee);

    if (!cleanName) {
      setErrorMsg('يرجى كتابة اسم المجموعة (مثال: مجموعة أبطال الرياضيات)');
      return;
    }
    if (!cleanCenter) {
      setErrorMsg('يرجى كتابة أو اختيار اسم السنتر / القاعة');
      return;
    }
    if (!cleanSubject) {
      setErrorMsg('يرجى تحديد المادة الدراسية');
      return;
    }
    if (Number.isNaN(feeNum) || feeNum < 0) {
      setErrorMsg('يرجى كتابة اشتراك الشهر بشكل صحيح (0 أو أكثر)');
      return;
    }

    // Check for schedule conflicts with teacher's other individual and group classes
    const groupSlots: ScheduleSlot[] = existingGroups
      .filter((g: any) => g.status === 'active' && !g.archived)
      .flatMap((g) =>
        (g.schedule || []).map((slot: any, idx: number) => ({
          id: `group_${g.id}_${idx}`,
          teacherId,
          studentId: `group_${g.id}`,
          studentName: `مجموعة ${g.name}`,
          dayOfWeek: slot.day,
          time: slot.time,
          duration: slot.duration || 90,
          recurrence: 'weekly' as const,
          classType: 'center' as const,
          color: g.color || '#8b5cf6',
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
    const allSlots = [...existingSchedules, ...groupSlots];

    for (const slot of scheduleSlots) {
      const conflictRes = hasConflict(
        {
          dayOfWeek: Number(slot.day),
          time: slot.time,
          duration: Number(slot.duration) || 90,
          studentName: cleanName,
        },
        allSlots
      );

      if (conflictRes.hasConflict) {
        setErrorMsg(conflictRes.message || 'عفواً، لديك حصة أو مجموعة أخرى في نفس هذا الموعد');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Save or get center
      let centerId = 'center_default';
      try {
        centerId = await addCenter(teacherId, cleanCenter);
        if (onCenterAdded) onCenterAdded(cleanCenter);
      } catch (cErr) {
        console.warn('Center auto-create error:', cErr);
      }

      // 2. Add group
      const newGroupId = await addGroup(teacherId, {
        name: cleanName,
        centerId,
        centerName: cleanCenter,
        subject: cleanSubject,
        grade,
        schedule: scheduleSlots,
        monthlyFee: feeNum,
        color,
        status,
        notes,
      });

      if (onGroupAdded) {
        onGroupAdded(newGroupId);
      }

      onClose();
    } catch (err: any) {
      console.error('Error adding group:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ المجموعة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">إضافة مجموعة جديدة (سنتر)</h3>
              <p className="text-[11px] text-purple-300/70">إنشاء مجموعة دراسية ومواعيدها وسعرها الشهري</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم المجموعة <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مجموعة الأوائل - الصف الثالث الإعدادي"
              className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition"
            />
          </div>

          {/* Center Name (with suggestions) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم السنتر / القاعة <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                placeholder="مثال: سنتر الأوائل - قاعة 1"
                className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition"
              />
              <Building2 className="w-4 h-4 text-purple-400 absolute right-3.5 top-3.5" />
            </div>

            {/* Quick Suggestions Chips */}
            {centerSuggestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-slate-400">اقتراحات سنتراتك:</span>
                {centerSuggestions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCenterName(c)}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 transition cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject & Grade Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                المادة الدراسية <span className="text-rose-400">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-3 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                {COMMON_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {subject === 'أخرى' && (
                <input
                  type="text"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="اكتب اسم المادة..."
                  className="w-full mt-2 rounded-2xl bg-slate-950 border border-slate-700/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              )}
            </div>

            {/* Grade */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">الصف الدراسي</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-3 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                {COMMON_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Fee & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                سعر الشهر لكل طالب ({currency}) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  placeholder="300"
                  className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-4 py-3 pr-10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                />
                <DollarSign className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">حالة المجموعة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
                className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 px-3 py-3 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                <option value="active">نشطة ومستمرة (Active) ✅</option>
                <option value="paused">متوقفة مؤقتاً (Paused) ⏸️</option>
              </select>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span>لون تمييز المجموعة</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                    color === c ? 'scale-115 border-white shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Schedule Section */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>أيام ومواعيد الحصص الأسبوعية</span>
              </span>
              <button
                type="button"
                onClick={handleAddScheduleSlot}
                className="flex items-center gap-1 text-[11px] font-bold text-purple-300 hover:text-purple-200 bg-purple-950/60 px-2.5 py-1 rounded-xl border border-purple-500/30 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة موعد</span>
              </button>
            </div>

            {scheduleSlots.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">لم تحدد مواعيد بعد لهذه المجموعة</p>
            ) : (
              <div className="space-y-2">
                {scheduleSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    {/* Day selector */}
                    <select
                      value={slot.day}
                      onChange={(e) =>
                        handleUpdateScheduleSlot(index, { day: Number.parseInt(e.target.value, 10) })
                      }
                      className="rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {WEEK_DAYS.map((d) => (
                        <option key={d.index} value={d.index}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    {/* Time input */}
                    <div className="flex items-center gap-1 flex-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => handleUpdateScheduleSlot(index, { time: e.target.value })}
                        className="rounded-xl bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white font-mono focus:outline-none w-full"
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveScheduleSlot(index)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: يرجى إحضار كشكول التمارين في كل حصة..."
              className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-purple-950/40 cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>حفظ وإنشاء المجموعة ✨</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
