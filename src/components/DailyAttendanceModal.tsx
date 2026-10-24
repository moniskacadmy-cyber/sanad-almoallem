import React, { useState, useEffect, useMemo } from 'react';
import {
  Student,
  TeacherProfile,
  ScheduleSlot,
  LessonLog,
  AbsencePolicySettings,
  DEFAULT_ABSENCE_POLICY,
} from '../types';
import { useBackHandler } from '../services/backHandler';
import {
  addLessonLog,
  toggleScheduleCompletedToday,
  updateStudent,
  fetchAllStudentLessons,
  addSchedule,
} from '../firebase';
import {
  buildEntitlement,
  getStudentGroupFee,
  getStudentMonthEntitlements,
  isMonthlyStudent,
  MonthlyEntitlement,
} from '../services/billing';
import { useGroupsAndMemberships, useMonthlyPaymentRecords } from '../services/useBilling';
import { PaymentChip, PaymentDialog } from './PaymentDialog';
import {
  createAbsenceReminderMessage,
  triggerAbsenceNotificationAndChime,
  getStoredReminderSettings,
} from '../services/reminderService';
import { AbsenceDetailsModal, AbsenceDetailsResult } from './AbsenceDetailsModal';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Copy,
  Check,
  Search,
  Sparkles,
  Bell,
  BellRing,
  Send,
  Users,
  Info,
} from 'lucide-react';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onAttendanceUpdated?: () => void;
  targetGroupId?: string | null;
  targetDate?: string;
  targetGroupName?: string;
  currency?: string;
}

interface ActiveAbsenceAlert {
  studentId: string;
  studentName: string;
  attendanceType: 'absent' | 'excused';
  whatsappUrl?: string;
  whatsappMessage: string;
  phone?: string;
}

export const DailyAttendanceModal: React.FC<DailyAttendanceModalProps> = ({
  isOpen,
  onClose,
  profile,
  students,
  schedules,
  onAttendanceUpdated,
  targetGroupId,
  targetDate,
  targetGroupName,
  currency: currencyProp,
}) => {
  useBackHandler(isOpen, onClose, 'daily_attendance_modal');

  const todayIso = new Intl.DateTimeFormat('en-CA').format(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(targetDate || todayIso);
  const [filterMode, setFilterMode] = useState<'scheduled' | 'all'>(targetGroupId ? 'all' : 'scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [allLessons, setAllLessons] = useState<Record<string, LessonLog[]>>({});
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (targetDate) {
      setSelectedDate(targetDate);
    }
  }, [targetDate]);

  // Payment status tracking for current selected month
  const currentMonthKey = useMemo(() => (selectedDate ? selectedDate.substring(0, 7) : todayIso.substring(0, 7)), [selectedDate, todayIso]);
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);
  const currency = currencyProp || profile.currency || 'ج.م';
  const monthRecords = useMonthlyPaymentRecords(profile.id, currentMonthKey, isOpen);
  const { groups: allGroups, memberships } = useGroupsAndMemberships(profile.id, isOpen);

  /** What this student owes (and has paid) this month: fixed monthly fee, pro-rata if joined mid-month. */
  const getEntitlement = (student: Student): MonthlyEntitlement => {
    const list = getStudentMonthEntitlements({
      student,
      groups: allGroups,
      memberships,
      records: monthRecords,
      monthKey: currentMonthKey,
    });
    const found = (targetGroupId && list.find((e) => e.groupId === targetGroupId)) || list[0];
    if (found) return found;
    const group = allGroups.find((g) => g.id === (targetGroupId || (student.groupIds && student.groupIds[0])));
    return buildEntitlement({
      studentId: student.id,
      studentName: student.name,
      groupId: group?.id || targetGroupId || null,
      groupName: group?.name || targetGroupName || '',
      standardFee: group ? getStudentGroupFee(student, group) : student.monthlyFee || 0,
      monthKey: currentMonthKey,
      record: monthRecords.find((r) => r.studentId === student.id) || null,
    });
  };

  // Auto-reminder toggle
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(true);

  // Active reminder alert banner
  const [latestAbsenceAlert, setLatestAbsenceAlert] = useState<ActiveAbsenceAlert | null>(null);

  // Submodal for fine-grained absence customization
  const [absenceSubModalStudent, setAbsenceSubModalStudent] = useState<Student | null>(null);
  const [absenceSubModalType, setAbsenceSubModalType] = useState<'absent' | 'excused'>('absent');

  // Policy & reminder settings
  const policy: AbsencePolicySettings = profile.absencePolicy || DEFAULT_ABSENCE_POLICY;
  const reminderSettings = getStoredReminderSettings();

  // Load existing lessons to know who is already marked for the selected date
  const loadLessons = async () => {
    if (!profile.id || students.length === 0) return;
    try {
      const logs = await fetchAllStudentLessons(profile.id, students);
      setAllLessons(logs);
    } catch (err) {
      console.warn('Failed to load lessons for daily attendance:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLessons();
    }
  }, [isOpen, profile.id, students.length]);

  // Derive day of week for selectedDate
  const parsedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  const selectedDayOfWeek = parsedDate.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayNameArabic = arabicDayNames[selectedDayOfWeek] || '';

  const formattedDateArabic = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(parsedDate);
    } catch {
      return selectedDate;
    }
  }, [parsedDate, selectedDate]);

  // Scheduled slots for this day
  const daySchedules = useMemo(() => {
    return schedules
      .filter((s) => s.dayOfWeek === selectedDayOfWeek)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [schedules, selectedDayOfWeek]);

  // Map of studentId -> today's schedule slot (if any)
  const scheduledStudentMap = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    daySchedules.forEach((slot) => {
      map.set(slot.studentId, slot);
    });
    return map;
  }, [daySchedules]);

  // Filter students based on filterMode & search query
  const displayedStudents = useMemo(() => {
    let list = students;
    if (targetGroupId) {
      list = students.filter(
        (s) => !s.archived && s.groupIds && s.groupIds.includes(targetGroupId)
      );
    } else if (filterMode === 'scheduled') {
      list = students.filter((s) => scheduledStudentMap.has(s.id));
      // If none scheduled on this day, fallback gracefully or show empty
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.whatsapp && s.whatsapp.includes(q)) ||
          s.subject.toLowerCase().includes(q)
      );
    }

    // Sort: scheduled first by time, then name
    return [...list].sort((a, b) => {
      const slotA = scheduledStudentMap.get(a.id);
      const slotB = scheduledStudentMap.get(b.id);
      if (slotA && slotB) {
        return slotA.time.localeCompare(slotB.time);
      }
      if (slotA && !slotB) return -1;
      if (!slotA && slotB) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [students, filterMode, scheduledStudentMap, searchQuery]);

  // Helper to get lesson for selected date
  const getStudentLessonForDate = (studentId: string): LessonLog | undefined => {
    const logs = allLessons[studentId] || [];
    return logs.find((l) => l.date === selectedDate);
  };

  // Real-time metrics
  const metrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let unrecorded = 0;

    displayedStudents.forEach((st) => {
      const lesson = getStudentLessonForDate(st.id);
      if (!lesson) {
        unrecorded++;
      } else if (lesson.attendance === 'present') {
        present++;
      } else if (lesson.attendance === 'absent') {
        absent++;
      } else if (lesson.attendance === 'excused') {
        excused++;
      }
    });

    const recordedTotal = present + absent + excused;
    const presentPercent =
      recordedTotal > 0 ? Math.round((present / recordedTotal) * 100) : 0;

    return {
      total: displayedStudents.length,
      present,
      absent,
      excused,
      unrecorded,
      presentPercent,
    };
  }, [displayedStudents, allLessons, selectedDate]);

  if (!isOpen) return null;

  // Format 12-hour time
  const formatTime12h = (time24: string) => {
    try {
      const [h, m] = time24.split(':').map(Number);
      const period = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${h12}:${m < 10 ? '0' + m : m} ${period}`;
    } catch {
      return time24;
    }
  };

  // Build WhatsApp URL
  const buildWhatsAppLink = (phone: string | undefined, message: string) => {
    if (!phone) return undefined;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    return `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`;
  };

  // 1. Mark Student Present
  const handleMarkPresent = async (student: Student) => {
    setProcessingStudentId(student.id);
    try {
      const slot = scheduledStudentMap.get(student.id);
      const duration = slot?.duration || 60;
      const hourlyRate =
        student.hourlyRate ||
        (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);
      const monthly = isMonthlyStudent(student);
      const cost = monthly ? 0 : Math.round((duration / 60) * hourlyRate);

      await addLessonLog(profile.id, student.id, {
        date: selectedDate,
        topic: slot?.notes?.trim() || `حصة مادة ${profile.subject}`,
        homework: '',
        attendance: 'present',
        duration,
        hourlyRate,
        cost,
        settled: false,
        rating: 5,
        notes: 'تم تسجيل الحضور عبر سجل الحضور والغياب اليومي',
        isFinancialCounted: !monthly,
        is_financial_counted: !monthly,
        hasMakeupClass: false,
        has_makeup_class: false,
      });

      // Decrement prepaid lesson balance if applicable
      if (student.remainingPaidLessons !== undefined && student.remainingPaidLessons > 0) {
        const nextRemaining = Math.max(0, student.remainingPaidLessons - 1);
        await updateStudent(profile.id, student.id, {
          remainingPaidLessons: nextRemaining,
        });
      }

      // If scheduled for today, toggle completed
      if (slot && selectedDate === todayIso) {
        await toggleScheduleCompletedToday(profile.id, slot.id, true);
      }

      await loadLessons();
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      console.error('Error marking student present:', err);
    } finally {
      setProcessingStudentId(null);
    }
  };

  // 2. Mark Student Absent or Excused (Automatic Reminder Activated)
  const handleMarkAbsenceOrExcused = async (
    student: Student,
    attendanceType: 'absent' | 'excused'
  ) => {
    setProcessingStudentId(student.id);
    try {
      const slot = scheduledStudentMap.get(student.id);
      const duration = slot?.duration || 60;
      const hourlyRate =
        student.hourlyRate ||
        (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);

      // Determine default financial & makeup behavior from Teacher's policy settings
      const isFinancialCounted = isMonthlyStudent(student)
        ? false
        : attendanceType === 'excused'
        ? policy.excusedCountsFinancially
        : policy.unexcusedCountsFinancially;

      const hasMakeupClass =
        attendanceType === 'excused'
          ? policy.excusedHasMakeup
          : policy.unexcusedHasMakeup;

      const cost = isFinancialCounted ? Math.round((duration / 60) * hourlyRate) : 0;
      const topicText =
        attendanceType === 'excused'
          ? 'اعتذار مسبق عن موعد الحصة'
          : 'غياب عن موعد الحصة بدون إشعار مسبق';

      await addLessonLog(profile.id, student.id, {
        date: selectedDate,
        topic: topicText,
        homework: '',
        attendance: attendanceType,
        duration,
        hourlyRate,
        cost,
        settled: false,
        rating: 1,
        notes: `تسجيل ${attendanceType === 'excused' ? 'اعتذار' : 'غياب'} عبر سجل الحضور اليومي`,
        isFinancialCounted,
        is_financial_counted: isFinancialCounted,
        hasMakeupClass,
        has_makeup_class: hasMakeupClass,
        makeupClassDate: null,
        makeup_class_date: null,
        absenceReasonType:
          attendanceType === 'excused' ? 'excused_early' : 'unexcused_sudden',
        absence_reason_type:
          attendanceType === 'excused' ? 'excused_early' : 'unexcused_sudden',
      });

      // If counted financially and has remaining paid lessons, decrement
      if (
        isFinancialCounted &&
        student.remainingPaidLessons !== undefined &&
        student.remainingPaidLessons > 0
      ) {
        const nextRemaining = Math.max(0, student.remainingPaidLessons - 1);
        await updateStudent(profile.id, student.id, {
          remainingPaidLessons: nextRemaining,
        });
      }

      // Mark slot completed if scheduled today
      if (slot && selectedDate === todayIso) {
        await toggleScheduleCompletedToday(profile.id, slot.id, true);
      }

      // Automatic Reminder Activation
      if (autoReminderEnabled) {
        const reminderMsg = createAbsenceReminderMessage({
          student,
          teacher: profile,
          dateStr: selectedDate,
          attendanceType,
          isFinancialCounted,
          hasMakeupClass,
          notes: '',
        });

        const waUrl = buildWhatsAppLink(student.whatsapp, reminderMsg);

        // Chime & native browser notification
        triggerAbsenceNotificationAndChime({
          studentName: student.name,
          attendanceType,
          dateStr: selectedDate,
          hasWhatsApp: !!student.whatsapp,
          soundEnabled: reminderSettings.soundEnabled,
        });

        // Set top alert banner for instant teacher action
        setLatestAbsenceAlert({
          studentId: student.id,
          studentName: student.name,
          attendanceType,
          whatsappUrl: waUrl,
          whatsappMessage: reminderMsg,
          phone: student.whatsapp,
        });
      }

      await loadLessons();
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      console.error('Error logging student absence/excuse:', err);
    } finally {
      setProcessingStudentId(null);
    }
  };

  // 3. Bulk Mark All Unrecorded as Present
  const handleBulkMarkPresent = async () => {
    const unrecordedStudents = displayedStudents.filter(
      (s) => !getStudentLessonForDate(s.id)
    );
    if (unrecordedStudents.length === 0) return;

    setProcessingStudentId('bulk');
    try {
      for (const student of unrecordedStudents) {
        const slot = scheduledStudentMap.get(student.id);
        const duration = slot?.duration || 60;
        const hourlyRate =
          student.hourlyRate ||
          (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);
        const monthly = isMonthlyStudent(student);
        const cost = monthly ? 0 : Math.round((duration / 60) * hourlyRate);

        await addLessonLog(profile.id, student.id, {
          date: selectedDate,
          topic: slot?.notes?.trim() || `حصة مادة ${profile.subject}`,
          attendance: 'present',
          duration,
          hourlyRate,
          cost,
          settled: false,
          rating: 5,
          notes: 'تحضير جماعي عبر سجل الحضور اليومي',
          isFinancialCounted: !monthly,
          is_financial_counted: !monthly,
          hasMakeupClass: false,
          has_makeup_class: false,
        });

        if (
          student.remainingPaidLessons !== undefined &&
          student.remainingPaidLessons > 0
        ) {
          await updateStudent(profile.id, student.id, {
            remainingPaidLessons: Math.max(0, student.remainingPaidLessons - 1),
          });
        }

        if (slot && selectedDate === todayIso) {
          await toggleScheduleCompletedToday(profile.id, slot.id, true);
        }
      }

      await loadLessons();
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      console.error('Error in bulk marking present:', err);
    } finally {
      setProcessingStudentId(null);
    }
  };

  // Copy WhatsApp message handler
  const handleCopyMessage = (studentId: string, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedStudentId(studentId);
    setTimeout(() => setCopiedStudentId(null), 2500);
  };

  // Confirm result from sub-modal
  const handleConfirmSubModalAbsence = async (result: AbsenceDetailsResult) => {
    if (!absenceSubModalStudent) return;
    const student = absenceSubModalStudent;
    setProcessingStudentId(student.id);
    try {
      const slot = scheduledStudentMap.get(student.id);
      const duration = slot?.duration || 60;
      const hourlyRate =
        student.hourlyRate ||
        (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);
      const counted = isMonthlyStudent(student) ? false : result.isFinancialCounted;
      const cost = counted ? Math.round((duration / 60) * hourlyRate) : 0;

      await addLessonLog(profile.id, student.id, {
        date: selectedDate,
        topic:
          result.absenceReasonType === 'excused_early'
            ? 'اعتذار مسبق عن موعد الحصة'
            : 'غياب عن موعد الحصة',
        homework: '',
        attendance: absenceSubModalType,
        duration,
        hourlyRate,
        cost,
        settled: false,
        notes: result.notes || '',
        isFinancialCounted: counted,
        is_financial_counted: counted,
        hasMakeupClass: result.hasMakeupClass,
        has_makeup_class: result.hasMakeupClass,
        makeupClassDate: result.makeupClassDate || null,
        makeup_class_date: result.makeupClassDate || null,
        absenceReasonType: result.absenceReasonType,
        absence_reason_type: result.absenceReasonType,
      });

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

      if (
        result.isFinancialCounted &&
        student.remainingPaidLessons !== undefined &&
        student.remainingPaidLessons > 0
      ) {
        await updateStudent(profile.id, student.id, {
          remainingPaidLessons: Math.max(0, student.remainingPaidLessons - 1),
        });
      }

      if (slot && selectedDate === todayIso) {
        await toggleScheduleCompletedToday(profile.id, slot.id, true);
      }

      if (result.whatsappMessage) {
        const waUrl = buildWhatsAppLink(student.whatsapp, result.whatsappMessage);
        triggerAbsenceNotificationAndChime({
          studentName: student.name,
          attendanceType: absenceSubModalType,
          dateStr: selectedDate,
          hasWhatsApp: !!student.whatsapp,
          soundEnabled: reminderSettings.soundEnabled,
        });
        setLatestAbsenceAlert({
          studentId: student.id,
          studentName: student.name,
          attendanceType: absenceSubModalType,
          whatsappUrl: waUrl,
          whatsappMessage: result.whatsappMessage,
          phone: student.whatsapp,
        });
      }

      setAbsenceSubModalStudent(null);
      await loadLessons();
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      console.error('Error confirming custom absence in modal:', err);
    } finally {
      setProcessingStudentId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl text-right max-h-[94vh] flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/50">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{targetGroupName ? `تسجيل حضور مجموعة: ${targetGroupName}` : 'سجل الحضور والغياب اليومي'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {dayNameArabic}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                تسجيل حضور وغياب الطلاب وتفعيل تذكيرات تلقائية فورية لأولياء الأمور
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
            title="إغلاق السجل"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date Selector & Mode Tabs */}
        <div className="space-y-2.5 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  selectedDate === todayIso
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                اليوم
              </button>
            </div>

            <div className="text-[11px] text-purple-200/80 font-medium">
              {formattedDateArabic}
            </div>
          </div>

          {/* Filter Pills & Auto-Reminder Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('scheduled')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterMode === 'scheduled'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>حصص اليوم ({daySchedules.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>جميع الطلاب ({students.length})</span>
              </button>
            </div>

            {/* Toggle: Automatic Reminder */}
            <button
              type="button"
              onClick={() => setAutoReminderEnabled(!autoReminderEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                autoReminderEnabled
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
              title="تفعيل إشعار وتذكير تلقائي فور تسجيل الغياب أو الاعتذار"
            >
              <BellRing className={`w-3.5 h-3.5 ${autoReminderEnabled ? 'animate-pulse' : ''}`} />
              <span>
                التذكير التلقائي للغياب: {autoReminderEnabled ? 'مُفعّل 🔔' : 'مُعطّل 🔕'}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الطالب أو رقم الهاتف..."
              className="w-full rounded-xl bg-slate-950/80 border border-slate-800 pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>

        {/* Real-time Attendance Stats Bar */}
        <div className="grid grid-cols-4 gap-2 text-center flex-shrink-0">
          <div className="bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-2">
            <span className="text-[10px] text-emerald-400 font-bold block">حاضرون ✅</span>
            <span className="text-base font-black text-emerald-300">{metrics.present}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              ({metrics.presentPercent}%)
            </span>
          </div>

          <div className="bg-slate-950/60 border border-rose-500/30 rounded-2xl p-2">
            <span className="text-[10px] text-rose-400 font-bold block">غائبون ❌</span>
            <span className="text-base font-black text-rose-300">{metrics.absent}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">تذكير تلقائي</span>
          </div>

          <div className="bg-slate-950/60 border border-amber-500/30 rounded-2xl p-2">
            <span className="text-[10px] text-amber-400 font-bold block">معتذرون ⚠️</span>
            <span className="text-base font-black text-amber-300">{metrics.excused}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">إشعار مسبق</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-700 rounded-2xl p-2">
            <span className="text-[10px] text-slate-400 font-bold block">لم يُسجل ⏳</span>
            <span className="text-base font-black text-slate-200">{metrics.unrecorded}</span>
            <span className="text-[9px] text-slate-500 block mt-0.5">
              من أصل {metrics.total}
            </span>
          </div>
        </div>

        {/* Quick Bulk Action */}
        {metrics.unrecorded > 0 && (
          <div className="flex items-center justify-between bg-purple-950/30 border border-purple-500/20 px-3 py-2 rounded-2xl flex-shrink-0">
            <div className="text-[11px] text-purple-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                يوجد <b>{metrics.unrecorded}</b> طالب لم يتم تسجيل حضورهم بعد.
              </span>
            </div>

            <button
              type="button"
              disabled={processingStudentId === 'bulk'}
              onClick={handleBulkMarkPresent}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {processingStudentId === 'bulk'
                  ? 'جارٍ التحضير...'
                  : 'تحضير الباقي كـ حاضر ✅'}
              </span>
            </button>
          </div>
        )}

        {/* Latest Automatic Absence Reminder Banner */}
        {latestAbsenceAlert && (
          <div className="rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 border border-rose-500/40 p-3.5 shadow-xl flex-shrink-0 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-500/40">
                  <Bell className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>تم تفعيل التذكير التلقائي لغياب:</span>
                    <span className="text-amber-300 underline font-black">
                      {latestAbsenceAlert.studentName}
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-300">
                    تم إعداد رسالة تذكير الغياب الرسمية لولي الأمر فور تسجيل الحالة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLatestAbsenceAlert(null)}
                className="text-slate-400 hover:text-white p-1"
                title="إخفاء التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {latestAbsenceAlert.whatsappUrl ? (
                <a
                  href={latestAbsenceAlert.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال التذكير لولي الأمر عبر واتساب 📲</span>
                </a>
              ) : (
                <span className="text-[10px] text-slate-400">
                  (لا يوجد رقم واتساب مسجل - انسخ الرسالة أدناه)
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  handleCopyMessage(
                    latestAbsenceAlert.studentId,
                    latestAbsenceAlert.whatsappMessage
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                {copiedStudentId === latestAbsenceAlert.studentId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تم نسخ نص التذكير!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ نص التذكير</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Student Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
          {displayedStudents.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/40 rounded-2xl border border-slate-800">
              <UserX className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">لا يوجد طلاب مطابقين للخيارات المحددة.</p>
              {filterMode === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300 font-bold underline"
                >
                  عرض جميع الطلاب المسجلين
                </button>
              )}
            </div>
          ) : (
            displayedStudents.map((student) => {
              const lesson = getStudentLessonForDate(student.id);
              const slot = scheduledStudentMap.get(student.id);
              const isProcessing = processingStudentId === student.id;

              const statusColor =
                !lesson
                  ? 'border-slate-800 bg-slate-950/50'
                  : lesson.attendance === 'present'
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : lesson.attendance === 'absent'
                  ? 'border-rose-500/40 bg-rose-950/20'
                  : 'border-amber-500/40 bg-amber-950/20';

              return (
                <div
                  key={student.id}
                  className={`rounded-2xl border p-3 transition space-y-2.5 ${statusColor}`}
                >
                  {/* Student Info Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-900/50 border border-purple-500/30 text-purple-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-white truncate">
                            {student.name}
                          </h3>
                          {student.whatsapp && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              📱 {student.whatsapp}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span>{student.subject}</span>
                          {slot && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300 font-bold flex items-center gap-0.5">
                                <Clock className="w-3 h-3 inline" />
                                {formatTime12h(slot.time)} ({slot.duration || 60} د)
                              </span>
                            </>
                          )}
                          {student.remainingPaidLessons !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-purple-300">
                                رصيد الحصص: {student.remainingPaidLessons}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Recorded Status & 1-Click Monthly Payment Status */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Monthly fee: only for group/center students (fixed monthly, not per lesson) */}
                      {isMonthlyStudent(student) && (
                        <PaymentChip
                          entitlement={getEntitlement(student)}
                          currency={currency}
                          onClick={() => setPaymentStudentId(student.id)}
                          size="sm"
                        />
                      )}

                      {lesson ? (
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              lesson.attendance === 'present'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : lesson.attendance === 'absent'
                                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                            }`}
                          >
                            {lesson.attendance === 'present'
                              ? 'حاضر ✅'
                              : lesson.attendance === 'absent'
                              ? 'غائب ❌'
                              : 'معتذر ⚠️'}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          لم يُسجل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleMarkPresent(student)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                        lesson?.attendance === 'present'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300'
                      }`}
                      title="تسجيل حضور الطالب"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>حاضر ✅</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleMarkAbsenceOrExcused(student, 'absent')}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                        lesson?.attendance === 'absent'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                          : 'bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300'
                      }`}
                      title="تسجيل غياب الطالب مع تفعيل تذكير تلقائي لولي الأمر"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>غياب ❌</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleMarkAbsenceOrExcused(student, 'excused')}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                        lesson?.attendance === 'excused'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                          : 'bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300'
                      }`}
                      title="تسجيل اعتذار مسبق عن الحصة مع إشعار ولي الأمر"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>اعتذار ⚠️</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAbsenceSubModalStudent(student);
                        setAbsenceSubModalType(
                          lesson?.attendance === 'excused' ? 'excused' : 'absent'
                        );
                      }}
                      className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold border border-slate-700 transition cursor-pointer"
                      title="خيارات متقدمة: تحديد الحساب المالي وجدولة الحصة التعويضية"
                    >
                      ⚙️ تفاصيل
                    </button>
                  </div>

                  {/* Inline Reminder Dispatch for Absent / Excused students */}
                  {lesson && (lesson.attendance === 'absent' || lesson.attendance === 'excused') && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Bell className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span>
                          {lesson.attendance === 'absent' ? 'تذكير غياب' : 'إشعار اعتذار'}:
                        </span>
                        {lesson.isFinancialCounted ? (
                          <span className="text-emerald-400 font-bold">محسوبة مالياً 💰</span>
                        ) : (
                          <span className="text-slate-400">غير محسوبة</span>
                        )}
                        {lesson.hasMakeupClass && (
                          <span className="text-indigo-300 font-bold">• لها تعويض 🔄</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {student.whatsapp && (
                          <a
                            href={buildWhatsAppLink(
                              student.whatsapp,
                              createAbsenceReminderMessage({
                                student,
                                teacher: profile,
                                dateStr: selectedDate,
                                attendanceType: lesson.attendance,
                                isFinancialCounted: !!lesson.isFinancialCounted,
                                hasMakeupClass: !!lesson.hasMakeupClass,
                                makeupClassDate: lesson.makeupClassDate,
                                notes: lesson.notes,
                              })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>واتساب</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleCopyMessage(
                              student.id,
                              createAbsenceReminderMessage({
                                student,
                                teacher: profile,
                                dateStr: selectedDate,
                                attendanceType:
                                  lesson.attendance === 'excused' ? 'excused' : 'absent',
                                isFinancialCounted: !!lesson.isFinancialCounted,
                                hasMakeupClass: !!lesson.hasMakeupClass,
                                makeupClassDate: lesson.makeupClassDate,
                                notes: lesson.notes,
                              })
                            )
                          }
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="نسخ نص التذكير"
                        >
                          {copiedStudentId === student.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            <span>
              يتم حفظ السجل وحسابات الحصص ومطالبات الطلاب المالية تلقائياً فور النقر.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-950/50"
          >
            إتمام وإغلاق
          </button>
        </div>
      </div>

      {paymentStudentId &&
        (() => {
          const st = students.find((x) => x.id === paymentStudentId);
          if (!st) return null;
          return (
            <PaymentDialog
              teacherId={profile.id}
              entitlement={getEntitlement(st)}
              currency={currency}
              onClose={() => setPaymentStudentId(null)}
            />
          );
        })()}

      {/* Sub-modal: Detailed Absence / Makeup Configuration */}
      {absenceSubModalStudent && (
        <AbsenceDetailsModal
          isOpen={!!absenceSubModalStudent}
          onClose={() => setAbsenceSubModalStudent(null)}
          student={absenceSubModalStudent}
          dateStr={selectedDate}
          initialAttendance={absenceSubModalType}
          profile={profile}
          topic={`حصة مادة ${profile.subject}`}
          onConfirm={handleConfirmSubModalAbsence}
        />
      )}
    </div>
  );
};
