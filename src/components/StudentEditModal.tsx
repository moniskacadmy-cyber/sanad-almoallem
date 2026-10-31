import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Video,
  UserCheck,
  Sparkles,
  Palette,
  Check,
  Brain,
  FileText,
  ChevronDown,
} from 'lucide-react';
import {
  Student,
  ScheduleSlot,
  ClassType,
  ALL_SUBJECTS,
} from '../types';
import {
  addStudent,
  updateStudent,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  cleanUndefined,
} from '../firebase';
import {
  WEEK_DAYS,
  TIME_SLOTS,
  CLASS_COLORS,
  getColorStyle,
} from './ScheduleTab';
import { VoiceInputButton } from './VoiceInputButton';
import { hasConflict } from '../services/conflictService';
import { formatTime12h } from '../utils/timeZone';

export const DURATION_OPTIONS = [
  { value: 30, label: '30 دقيقة' },
  { value: 45, label: '45 دقيقة' },
  { value: 60, label: '60 دقيقة' },
  { value: 90, label: '90 دقيقة' },
  { value: 120, label: '120 دقيقة' },
];

export interface FormScheduleSlot {
  id?: string; // Existing ScheduleSlot id in Firestore
  tempId?: string; // Temp local id for new rows
  dayOfWeek: number;
  time: string;
  duration: number;
  recurrence?: string;
  isDeleted?: boolean;
}

export interface StudentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  student?: Student | null; // null if adding new student
  schedules?: ScheduleSlot[]; // all existing teacher schedules for conflict checking & loading
  defaultSubject?: string;
  currency?: string;
  onSuccess: () => void;
}

/** Calculate end time string from start time (HH:MM) + duration minutes */
export function calculateEndTimeLabel(startTime24: string, durationMinutes: number): string {
  if (!startTime24) return '';
  const [h, m] = startTime24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return startTime24;
  const totalMin = h * 60 + m + (durationMinutes || 60);
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const period = endH < 12 ? 'ص' : 'م';
  const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH;
  const displayM = endM === 0 ? '00' : endM < 10 ? `0${endM}` : String(endM);
  return `${displayH.toString().padStart(2, '0')}:${displayM} ${period}`;
}

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  isOpen,
  onClose,
  teacherId,
  student,
  schedules = [],
  defaultSubject = 'رياضيات',
  currency = 'ج.م',
  onSuccess,
}) => {
  // Form Fields State
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formSubject, setFormSubject] = useState(defaultSubject);
  const [formClassType, setFormClassType] = useState<ClassType>('in_person');
  const [formBillingType, setFormBillingType] = useState<'hourly' | 'monthly'>('hourly');
  const [formHourlyRate, setFormHourlyRate] = useState<number>(100);
  const [formMonthlyFee, setFormMonthlyFee] = useState<number>(300);
  const [formRemainingPaidLessons, setFormRemainingPaidLessons] = useState('');
  const [formTotalPrepaidLessons, setFormTotalPrepaidLessons] = useState('');
  const [formLearningStyle, setFormLearningStyle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formColor, setFormColor] = useState('emerald');

  // Schedules State for this Student
  const [scheduleRows, setScheduleRows] = useState<FormScheduleSlot[]>([]);

  // UI Toggles & Errors
  const [isLearningStyleOpen, setIsLearningStyleOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearFieldError = (field: string) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Load / Reset data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setFormErrors({});
    setErrorMessage(null);

    if (student) {
      setFormName(student.name || '');
      setFormWhatsapp(student.whatsapp || student.phone || '');
      setFormSubject(student.subject || defaultSubject);
      setFormClassType(student.classType || 'in_person');
      const isMonthlyStudent =
        student.billingType === 'monthly' ||
        (student.groupIds && student.groupIds.length > 0) ||
        student.classType === 'center';
      setFormBillingType(student.billingType || (isMonthlyStudent ? 'monthly' : 'hourly'));
      setFormHourlyRate(student.hourlyRate || (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100));
      setFormMonthlyFee(student.monthlyFee || (student.hourlyRate ? student.hourlyRate * 4 : 300));
      setFormRemainingPaidLessons(
        student.remainingPaidLessons !== undefined && student.remainingPaidLessons !== null
          ? String(student.remainingPaidLessons)
          : ''
      );
      setFormTotalPrepaidLessons(
        student.totalPrepaidLessons !== undefined && student.totalPrepaidLessons !== null
          ? String(student.totalPrepaidLessons)
          : ''
      );
      setFormLearningStyle(student.learningStyle || '');
      setFormNotes(student.notes || '');
      setIsLearningStyleOpen(!!student.learningStyle);
      setIsNotesOpen(!!student.notes);
      setFormColor(student.color || 'emerald');

      // Populate existing schedules for this student
      const existingStudentSchedules = schedules
        .filter((s) => s.studentId === student.id)
        .map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          time: s.time,
          duration: s.duration || 60,
          recurrence: s.recurrence || 'weekly',
          isDeleted: false,
        }));
      setScheduleRows(existingStudentSchedules);
    } else {
      // Adding new student
      setFormName('');
      setFormWhatsapp('');
      setFormSubject(defaultSubject);
      setFormClassType('in_person');
      setFormBillingType('hourly');
      setFormHourlyRate(100);
      setFormMonthlyFee(300);
      setFormRemainingPaidLessons('');
      setFormTotalPrepaidLessons('');
      setFormLearningStyle('');
      setFormNotes('');
      setIsLearningStyleOpen(false);
      setIsNotesOpen(false);
      setFormColor('emerald');
      setScheduleRows([]);
    }
  }, [isOpen, student, schedules, defaultSubject]);

  if (!isOpen) return null;

  // Add new schedule slot row
  const handleAddScheduleRow = () => {
    const newRow: FormScheduleSlot = {
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      dayOfWeek: 0, // الأحد
      time: '16:00',
      duration: 60,
      recurrence: 'weekly',
      isDeleted: false,
    };
    setScheduleRows((prev) => [...prev, newRow]);
  };

  // Update schedule row
  const handleUpdateScheduleRow = (identifier: { id?: string; tempId?: string }, updates: Partial<FormScheduleSlot>) => {
    setScheduleRows((prev) =>
      prev.map((row) => {
        if ((identifier.id && row.id === identifier.id) || (identifier.tempId && row.tempId === identifier.tempId)) {
          return { ...row, ...updates };
        }
        return row;
      })
    );
  };

  // Remove schedule row
  const handleRemoveScheduleRow = (identifier: { id?: string; tempId?: string }) => {
    setScheduleRows((prev) =>
      prev
        .map((row) => {
          if ((identifier.id && row.id === identifier.id) || (identifier.tempId && row.tempId === identifier.tempId)) {
            if (row.id) {
              return { ...row, isDeleted: true };
            }
            return null;
          }
          return row;
        })
        .filter(Boolean) as FormScheduleSlot[]
    );
  };

  // Check schedule conflict helper
  const checkConflict = (dayOfWeek: number, time: string, duration: number, ignoreScheduleId?: string): string | null => {
    const result = hasConflict(
      { dayOfWeek, time, duration },
      schedules,
      ignoreScheduleId
    );
    if (result.hasConflict && result.message) {
      return result.message;
    }
    return null;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate required fields
    const errors: Record<string, string> = {};
    if (!formName.trim()) {
      errors.name = 'اسم الطالب مطلوب ولا يمكن أن يكون فارغاً';
    }
    if (!formSubject.trim()) {
      errors.subject = 'المادة الدراسية مطلوبة';
    }
    if (!formClassType) {
      errors.classType = 'يرجى اختيار تصنيف نوع الحصة';
    }
    if (
      formBillingType === 'hourly' &&
      (formHourlyRate === undefined || formHourlyRate === null || Number.isNaN(Number(formHourlyRate)) || Number(formHourlyRate) < 0)
    ) {
      errors.hourlyRate = 'يرجى إدخال سعر الساعة بشكل صحيح';
    }
    if (
      formBillingType === 'monthly' &&
      (formMonthlyFee === undefined || formMonthlyFee === null || Number.isNaN(Number(formMonthlyFee)) || Number(formMonthlyFee) < 0)
    ) {
      errors.monthlyFee = 'يرجى إدخال قيمة الاشتراك الشهري بشكل صحيح';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // 2. Validate schedule conflicts
    const activeRows = scheduleRows.filter((r) => !r.isDeleted);
    for (const r of activeRows) {
      const conflictErr = checkConflict(Number(r.dayOfWeek), r.time, Number(r.duration) || 60, r.id);
      if (conflictErr) {
        setErrorMessage(conflictErr);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const rate = Math.max(0, Number(formHourlyRate) || 100);
      const mFee =
        formBillingType === 'monthly'
          ? Math.max(0, Number(formMonthlyFee) || 300)
          : Number(formMonthlyFee) || rate * 4;
      const remPaid =
        formRemainingPaidLessons.trim() !== '' && !Number.isNaN(Number(formRemainingPaidLessons))
          ? Math.max(0, Number(formRemainingPaidLessons))
          : 0;
      const totPrepaid =
        formTotalPrepaidLessons.trim() !== '' && !Number.isNaN(Number(formTotalPrepaidLessons))
          ? Math.max(remPaid, Number(formTotalPrepaidLessons))
          : remPaid;

      // Construct sanitized student object payload
      const studentPayload = cleanUndefined({
        name: formName.trim(),
        whatsapp: formWhatsapp.trim() || '',
        phone: formWhatsapp.trim() || '',
        subject: formSubject.trim(),
        classType: formClassType,
        billingType: formBillingType,
        hourlyRate: rate,
        monthlyFee: mFee,
        remainingPaidLessons: remPaid,
        totalPrepaidLessons: totPrepaid,
        learningStyle: formLearningStyle.trim() || '',
        notes: formNotes.trim() || '',
        color: formColor || 'emerald',
      });

      let targetStudentId = student?.id;

      if (student) {
        // Update Student
        await updateStudent(teacherId, student.id, studentPayload);
      } else {
        // Add Student
        targetStudentId = await addStudent(teacherId, {
          ...studentPayload,
          paymentStatus: 'unpaid',
        });
      }

      // Handle Schedule Slots in Firestore
      if (targetStudentId) {
        for (const row of scheduleRows) {
          if (row.isDeleted && row.id) {
            // Delete schedule doc
            await deleteSchedule(teacherId, row.id);
          } else if (!row.isDeleted && row.id) {
            // Update schedule doc
            await updateSchedule(
              teacherId,
              row.id,
              cleanUndefined({
                dayOfWeek: Number(row.dayOfWeek),
                time: row.time,
                duration: Number(row.duration) || 60,
                recurrence: 'weekly',
                classType: formClassType,
                color: formColor || 'emerald',
              })
            );
          } else if (!row.isDeleted && !row.id) {
            // Add new schedule doc
            await addSchedule(
              teacherId,
              cleanUndefined({
                studentId: targetStudentId,
                studentName: formName.trim(),
                dayOfWeek: Number(row.dayOfWeek),
                time: row.time,
                duration: Number(row.duration) || 60,
                recurrence: 'weekly',
                classType: formClassType,
                color: formColor || 'emerald',
              })
            );
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving student or schedules in StudentEditModal:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ بيانات الطالب ومواعيده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeVisibleScheduleRows = scheduleRows.filter((r) => !r.isDeleted);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans dir-rtl"
      dir="rtl"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-purple-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl text-right max-h-[85vh] sm:max-h-[90vh] flex flex-col relative overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shrink-0">
              <User className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {student ? 'تعديل بيانات الطالب والمواعيد' : 'إضافة طالب جديد وتحديد المواعيد'}
              </h3>
              <p className="text-[11px] text-purple-300/80">
                إدارة البيانات الشخصية والمالية ومواعيد الحصص الأسبوعية للطالب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scroll-smooth pr-1 space-y-4 pb-2">
          {/* General Error Alert */}
          {errorMessage && (
            <div className="rounded-2xl bg-rose-950/90 border border-rose-500/50 p-3 flex items-start gap-2.5 text-rose-200 text-xs shadow-lg animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-bold text-rose-300 mb-0.5">تنبيه!</p>
                <p className="text-[11px] text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Student Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                اسم الطالب *
              </label>
              <span className="text-[10px] text-purple-300">إدخال بالصوت 🎤</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="مثال: يوسف خالد"
                className={`flex-1 min-h-[42px] rounded-xl bg-slate-800 border px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 ${
                  formErrors.name ? 'border-rose-500' : 'border-slate-700'
                }`}
              />
              <VoiceInputButton
                compact
                onTranscript={(transcript) => {
                  const cleanName = transcript.replace(/^(الطالب|طالب|الطالبة|طالبة)\s+/i, '').trim();
                  setFormName(cleanName || transcript.trim());
                  clearFieldError('name');
                }}
              />
            </div>
            {formErrors.name && (
              <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{formErrors.name}</span>
              </p>
            )}
          </div>

          {/* WhatsApp / Phone */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              رقم الواتساب (للطالب أو ولي الأمر) <span className="text-slate-400 font-normal">(اختياري)</span>
            </label>
            <input
              type="tel"
              value={formWhatsapp}
              onChange={(e) => setFormWhatsapp(e.target.value)}
              placeholder="01012345678 (اختياري)"
              dir="ltr"
              className="w-full min-h-[42px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 text-right"
            />
          </div>

          {/* Subject Select */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">المادة الدراسية *</label>
            <select
              value={ALL_SUBJECTS.includes(formSubject) ? formSubject : 'أخرى'}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'أخرى') {
                  setFormSubject(val);
                } else {
                  setFormSubject('');
                }
                clearFieldError('subject');
              }}
              className={`w-full min-h-[42px] rounded-xl bg-slate-800 border px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer ${
                formErrors.subject ? 'border-rose-500' : 'border-slate-700'
              }`}
            >
              <option value="" disabled>-- اختر المادة الدراسية --</option>
              {ALL_SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>

            {!ALL_SUBJECTS.includes(formSubject) && (
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="اكتب اسم المادة المخصصة..."
                className="w-full mt-2 min-h-[42px] rounded-xl bg-slate-800 border border-purple-500/50 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            )}

            {formErrors.subject && (
              <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{formErrors.subject}</span>
              </p>
            )}
          </div>

          {/* Class Type Classification */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>تصنيف نوع الحصة *</span>
              <span className="text-[10px] text-purple-300 font-normal">يحدد لون ووسم الحصة في الجدول</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormClassType('online');
                  setFormColor('cyan');
                  clearFieldError('classType');
                }}
                className={`p-2.5 min-h-[48px] rounded-2xl text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                  formClassType === 'online'
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200 ring-2 ring-sky-400/40 shadow-lg scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>أونلاين</span>
                </div>
                <span className="text-[9px] opacity-75 font-normal">عبر الإنترنت 🌐</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormClassType('in_person');
                  setFormColor('emerald');
                  clearFieldError('classType');
                }}
                className={`p-2.5 min-h-[48px] rounded-2xl text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                  formClassType === 'in_person' || formClassType === 'private' || formClassType === 'center'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-lg scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>حضور شخصي</span>
                </div>
                <span className="text-[9px] opacity-75 font-normal">منزل / سنتر 👤</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormClassType('trial');
                  setFormColor('amber');
                  clearFieldError('classType');
                }}
                className={`p-2.5 min-h-[48px] rounded-2xl text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                  formClassType === 'trial'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>حصة تجريبية</span>
                </div>
                <span className="text-[9px] opacity-75 font-normal">تقييم وتعارف ✨</span>
              </button>
            </div>
            {formErrors.classType && (
              <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{formErrors.classType}</span>
              </p>
            )}
          </div>

          {/* Billing Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>نظام الحساب والفوترة *</span>
              <span className="text-[10px] text-purple-300 font-normal">
                {formBillingType === 'monthly' ? 'اشتراك شهري ثابت' : 'حساب بالساعة / الحصة'}
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormBillingType('monthly');
                  clearFieldError('billingType');
                }}
                className={`p-2.5 min-h-[48px] rounded-2xl text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                  formBillingType === 'monthly'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-2 ring-purple-400/40 shadow-lg scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>اشتراك شهري ثابت 🏫</span>
                <span className="text-[9px] opacity-75 font-normal">طالب مجموعة / سنتر</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormBillingType('hourly');
                  clearFieldError('billingType');
                }}
                className={`p-2.5 min-h-[48px] rounded-2xl text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                  formBillingType === 'hourly'
                    ? 'bg-sky-600/30 border-sky-400 text-sky-200 ring-2 ring-sky-400/40 shadow-lg scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>حساب بالساعة / الحصة 👤</span>
                <span className="text-[9px] opacity-75 font-normal">طالب فردي / خاص</span>
              </button>
            </div>
          </div>

          {/* Pricing Fields */}
          {formBillingType === 'monthly' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>الاشتراك الشهري الثابت *</span>
                <span className="text-[10px] text-amber-300 font-normal">ثابت ولا يتأثر بالحضور والغياب</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formMonthlyFee}
                  onChange={(e) => {
                    setFormMonthlyFee(Number(e.target.value));
                    clearFieldError('monthlyFee');
                  }}
                  placeholder="300"
                  min={0}
                  className={`w-full min-h-[42px] rounded-xl bg-slate-800 border px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 ${
                    formErrors.monthlyFee ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                  {currency} / شهرياً
                </span>
              </div>
              {formErrors.monthlyFee && (
                <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{formErrors.monthlyFee}</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>سعر الساعة (Hourly Rate) *</span>
                <span className="text-[10px] text-amber-300 font-normal">تُحسب قيمة الحصة تلقائياً بالحضور</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formHourlyRate}
                  onChange={(e) => {
                    setFormHourlyRate(Number(e.target.value));
                    clearFieldError('hourlyRate');
                  }}
                  placeholder="100"
                  min={0}
                  className={`w-full min-h-[42px] rounded-xl bg-slate-800 border px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 ${
                    formErrors.hourlyRate ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 pointer-events-none">
                  {currency} / ساعة
                </span>
              </div>
              {formErrors.hourlyRate && (
                <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{formErrors.hourlyRate}</span>
                </p>
              )}
            </div>
          )}

          {/* Prepaid Lessons Balance */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
              <span>رصيد باقة الحصص المدفوعة</span>
              <span className="text-[10px] text-amber-300 font-normal">اختياري - تنبيه عند قرب النفاد</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  value={formRemainingPaidLessons}
                  onChange={(e) => setFormRemainingPaidLessons(e.target.value)}
                  placeholder="مثال: 8"
                  min={0}
                  className="w-full min-h-[42px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">
                  الحصص المتبقية بالرصيد
                </span>
              </div>
              <div>
                <input
                  type="number"
                  value={formTotalPrepaidLessons}
                  onChange={(e) => setFormTotalPrepaidLessons(e.target.value)}
                  placeholder="مثال: 8"
                  min={0}
                  className="w-full min-h-[42px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">
                  سعة الباقة الإجمالية
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible 1: Learning Style */}
          <div className="rounded-2xl border border-purple-500/25 bg-slate-900/60 overflow-hidden transition-all shadow-sm">
            <button
              type="button"
              onClick={() => setIsLearningStyleOpen(!isLearningStyleOpen)}
              className="w-full p-3 flex items-center justify-between text-right cursor-pointer hover:bg-purple-950/30 transition min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    إزاي الطالب ده بيتعلم أحسن؟
                  </span>
                  <span className="text-[10px] text-purple-300/80">
                    {formLearningStyle ? 'تم تدوين أسلوب التعلم ✏️' : 'ملاحظات أسلوب التعلم الذكية (اختياري)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[10px] font-medium">
                  {isLearningStyleOpen ? 'إغلاق' : 'إضافة'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transform transition-transform duration-200 ${
                    isLearningStyleOpen ? 'rotate-180 text-purple-400' : ''
                  }`}
                />
              </div>
            </button>

            {isLearningStyleOpen && (
              <div className="p-3 pt-0 border-t border-purple-900/30 space-y-2 mt-2">
                <textarea
                  value={formLearningStyle}
                  onChange={(e) => setFormLearningStyle(e.target.value)}
                  placeholder="مثال: نمط بصري يفضل الرسوم التوضيحية، يحتاج تشجيع مستمر..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            )}
          </div>

          {/* Collapsible 2: Notes */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all shadow-sm">
            <button
              type="button"
              onClick={() => setIsNotesOpen(!isNotesOpen)}
              className="w-full p-3 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/40 transition min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    ملاحظات إضافية
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formNotes ? 'يوجد ملاحظات مسجلة 📝' : 'ملاحظات حول المواعيد أو متطلبات خاصة (اختياري)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[10px] font-medium">
                  {isNotesOpen ? 'إغلاق' : 'إضافة'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transform transition-transform duration-200 ${
                    isNotesOpen ? 'rotate-180 text-purple-400' : ''
                  }`}
                />
              </div>
            </button>

            {isNotesOpen && (
              <div className="p-3 pt-0 border-t border-slate-800/60 space-y-2 mt-2">
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات حول المواعيد أو متطلبات خاصة..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            )}
          </div>

          {/* Color Palette Selector */}
          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>لون الحصة / الطالب في الجدول:</span>
              </span>
              <span className="text-purple-300 font-bold">
                {getColorStyle(formColor).name}
              </span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto py-1">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormColor(c.id)}
                  className={`w-7 h-7 rounded-full border-2 transition cursor-pointer shrink-0 flex items-center justify-center ${
                    formColor === c.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {formColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* PROMINENT SECTION: (المواعيد والحصص المحددة للطالب) */}
          <div className="pt-2 border-t border-purple-900/40 space-y-3">
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3.5 sm:p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      المواعيد والحصص المحددة للطالب
                    </h4>
                    <p className="text-[10px] text-purple-300/80">
                      مواعيد الحصص الأسبوعية الثابتة للطالب في جدول الأسبوع
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddScheduleRow}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md cursor-pointer min-h-[38px] active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ إضافة موعد للحصة</span>
                </button>
              </div>

              {/* List of Active Schedules */}
              {activeVisibleScheduleRows.length === 0 ? (
                <div className="text-center py-6 bg-slate-900/80 border border-dashed border-purple-500/20 rounded-2xl p-4 text-slate-400 text-xs">
                  <p className="font-bold text-slate-300 mb-1">لا توجد مواعيد محددة للطالب حتى الآن</p>
                  <p className="text-[11px] text-slate-500">
                    اضغط على زر <span className="text-purple-300 font-bold">(+ إضافة موعد للحصة)</span> لتثبيت مواعيد الدروس الأسبوعية للطالب.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {scheduleRows.map((row, idx) => {
                    if (row.isDeleted) return null;
                    const dayObj = WEEK_DAYS.find((d) => d.dayIndex === row.dayOfWeek) || WEEK_DAYS[0];
                    const endTimeLabel = calculateEndTimeLabel(row.time, row.duration || 60);

                    return (
                      <div
                        key={row.id || row.tempId || idx}
                        className="rounded-2xl bg-slate-900 border border-purple-500/40 p-3 space-y-2.5 text-right relative shadow-md hover:border-purple-400 transition"
                      >
                        {/* Summary Badge Row */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-[11px] font-bold">
                              موعد #{idx + 1}: {dayObj.name}
                            </span>
                            <span className="text-xs font-bold text-amber-300 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>
                                {formatTime12h(row.time)} إلى {endTimeLabel} ({row.duration || 60} دقيقة)
                              </span>
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-medium">
                              🔄 أسبوعياً
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveScheduleRow({ id: row.id, tempId: row.tempId })}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف هذا الموعد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quick Edit Controls Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                          {/* Day */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">اليوم</label>
                            <select
                              value={row.dayOfWeek}
                              onChange={(e) =>
                                handleUpdateScheduleRow(
                                  { id: row.id, tempId: row.tempId },
                                  { dayOfWeek: Number(e.target.value) }
                                )
                              }
                              className="w-full min-h-[38px] rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                            >
                              {WEEK_DAYS.map((d) => (
                                <option key={d.dayIndex} value={d.dayIndex}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Start Time */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">وقت البدء</label>
                            <select
                              value={row.time}
                              onChange={(e) =>
                                handleUpdateScheduleRow(
                                  { id: row.id, tempId: row.tempId },
                                  { time: e.target.value }
                                )
                              }
                              className="w-full min-h-[38px] rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                            >
                              {TIME_SLOTS.map((t) => (
                                <option key={t.time24} value={t.time24}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Duration */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">المدة / الانتهاء</label>
                            <select
                              value={row.duration}
                              onChange={(e) =>
                                handleUpdateScheduleRow(
                                  { id: row.id, tempId: row.tempId },
                                  { duration: Number(e.target.value) }
                                )
                              }
                              className="w-full min-h-[38px] rounded-xl bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                            >
                              {DURATION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer for Mobile Accessibility */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md pt-3 pb-1 border-t border-slate-800/80 z-20 shrink-0 mt-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition disabled:opacity-50"
            >
              <User className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جارٍ الحفظ والاقتران...'
                  : student
                  ? 'حفظ التعديلات'
                  : 'إضافة الطالب وتثبيت المواعيد'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
