import React, { useState, useEffect } from 'react';
import { TeacherProfile, Student, ScheduleSlot, LessonLog } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { useBackHandler } from '../services/backHandler';
import {
  addLessonLog,
  toggleScheduleCompletedToday,
  updateStudent,
  fetchAllStudentLessons,
  addSchedule,
} from '../firebase';
import { AbsenceDetailsModal, AbsenceDetailsResult } from './AbsenceDetailsModal';
import { DailyAttendanceModal } from './DailyAttendanceModal';
import {
  triggerAbsenceNotificationAndChime,
  getStoredReminderSettings,
} from '../services/reminderService';
import { LiveCountdown } from './LiveCountdown';
const StatsChart = React.lazy(() => import('./StatsChart'));
import {
  Calendar,
  Users,
  Play,
  Clock,
  Sparkles,
  MessageCircle,
  Check,
  TrendingUp,
  BookOpen,
  UserPlus,
  Settings,
  FileText,
  Crown,
  ArrowLeft,
  Copy,
  UserCheck,
} from 'lucide-react';

interface HomeTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onNavigateToTab: (tabIndex: number) => void;
  onOpenUpgradeModal: () => void;
  onOpenFinancialDashboard?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  profile,
  students,
  schedules: rawSchedules,
  onNavigateToTab,
  onOpenUpgradeModal,
  onOpenFinancialDashboard,
}) => {
  // Only valid schedules belonging to active students
  const schedules = rawSchedules.filter((s) => students.some((st) => st.id === s.studentId));

  // Modal State for "تسجيل حصة"
  const [showStartClassModal, setShowStartClassModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classTopic, setClassTopic] = useState('');
  const [classHomework, setClassHomework] = useState('');
  const [attendance, setAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const rating = 5; // تقييم الحصة الافتراضي الكامل
  const [savingClass, setSavingClass] = useState(false);

  // Edit Before Send Modal for Class Report
  const [showClassReportEditModal, setShowClassReportEditModal] = useState(false);
  const [pendingReportStudent, setPendingReportStudent] = useState<Student | null>(null);
  const [editableClassReportText, setEditableClassReportText] = useState('');
  const [copiedClassReport, setCopiedClassReport] = useState(false);

  // Absence Details Smart Modal State
  const [absenceModalStudent, setAbsenceModalStudent] = useState<Student | null>(null);
  const [absenceModalType, setAbsenceModalType] = useState<'absent' | 'excused'>('absent');
  const [absenceModalTopic, setAbsenceModalTopic] = useState<string>('');

  // Daily Attendance Register Modal State
  const [showDailyAttendanceModal, setShowDailyAttendanceModal] = useState(false);

  // Register modals on back handler stack
  useBackHandler(showStartClassModal, () => setShowStartClassModal(false), 'home_start_class_modal');
  useBackHandler(showClassReportEditModal, () => setShowClassReportEditModal(false), 'home_class_report_edit_modal');
  useBackHandler(!!absenceModalStudent, () => setAbsenceModalStudent(null), 'home_absence_modal');
  useBackHandler(showDailyAttendanceModal, () => setShowDailyAttendanceModal(false), 'home_daily_attendance_modal');

  // Date & Time helpers
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0: Sunday ... 6: Saturday
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayArabicName = arabicDays[currentDayOfWeek];
  const dateFormatted = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  // Minute ticker for next scheduled class lookup (updates every 60s instead of every second)
  const [minuteNow, setMinuteNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setMinuteNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const nextClassInfo = (() => {
    const base = new Date(minuteNow);
    base.setSeconds(0, 0);

    for (let offset = 0; offset <= 7; offset += 1) {
      const candidateDate = new Date(base);
      candidateDate.setDate(base.getDate() + offset);
      const candidateDay = candidateDate.getDay();
      const candidates = schedules
        .filter((slot) => slot.dayOfWeek === candidateDay)
        .filter((slot) => offset > 0 || slot.completedTodayDate !== todayStr)
        .filter((slot) => /^\d{1,2}:\d{2}$/.test(slot.time))
        .map((slot) => {
          const [hour, minute] = slot.time.split(':').map(Number);
          const target = new Date(candidateDate);
          target.setHours(hour, minute, 0, 0);
          return { slot, target };
        })
        .filter(({ target }) => target.getTime() > minuteNow.getTime())
        .sort((a, b) => a.target.getTime() - b.target.getTime());

      if (candidates.length > 0) {
        const candidate = candidates[0];
        return {
          ...candidate,
          dayLabel:
            offset === 0
              ? 'اليوم'
              : offset === 1
              ? 'غداً'
              : new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(candidate.target),
        };
      }
    }
    return null;
  })();

  // Filter and sort today's classes
  const todayClasses = schedules
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Evaluate remaining (not completed yet today)
  const remainingTodayClasses = todayClasses.filter((slot) => {
    if (slot.completedTodayDate === todayStr) {
      return false;
    }
    return true;
  });

  // Weekly Planned vs Completed Lessons Chart Calculation (recharts)
  const [weeklyLessonLogs, setWeeklyLessonLogs] = useState<LessonLog[]>([]);

  useEffect(() => {
    if (!profile?.id || students.length === 0) return;
    let isMounted = true;
    fetchAllStudentLessons(profile.id, students)
      .then((res) => {
        if (!isMounted) return;
        const all: LessonLog[] = [];
        Object.values(res).forEach((list) => all.push(...list));
        setWeeklyLessonLogs(all);
      })
      .catch((err) => console.warn('Could not load lessons for weekly chart:', err));
    return () => {
      isMounted = false;
    };
  }, [profile?.id, students]);

  // Current week days (Saturday to Friday)
  const currentWeekDays = [
    { name: 'السبت', dayOfWeek: 6, offsetFromSat: 0 },
    { name: 'الأحد', dayOfWeek: 0, offsetFromSat: 1 },
    { name: 'الإثنين', dayOfWeek: 1, offsetFromSat: 2 },
    { name: 'الثلاثاء', dayOfWeek: 2, offsetFromSat: 3 },
    { name: 'الأربعاء', dayOfWeek: 3, offsetFromSat: 4 },
    { name: 'الخميس', dayOfWeek: 4, offsetFromSat: 5 },
    { name: 'الجمعة', dayOfWeek: 5, offsetFromSat: 6 },
  ];

  // Find Saturday of the current week
  const diffToSaturday = (currentDayOfWeek + 1) % 7;
  const currentWeekSat = new Date(now);
  currentWeekSat.setDate(now.getDate() - diffToSaturday);
  currentWeekSat.setHours(0, 0, 0, 0);

  const weeklyChartData = currentWeekDays.map((d) => {
    const dayDate = new Date(currentWeekSat);
    dayDate.setDate(currentWeekSat.getDate() + d.offsetFromSat);
    const dayDateStr = new Intl.DateTimeFormat('en-CA').format(dayDate);

    // Planned: total slots scheduled for this day of week
    const planned = schedules.filter((s) => s.dayOfWeek === d.dayOfWeek).length;

    // Completed: lessons logged on this date OR slots marked completed today
    const lessonsOnThisDay = weeklyLessonLogs.filter((l) => l.date === dayDateStr).length;
    const slotsCompletedToday =
      dayDateStr === todayStr
        ? schedules.filter((s) => s.dayOfWeek === d.dayOfWeek && s.completedTodayDate === todayStr).length
        : 0;

    const completed = Math.max(lessonsOnThisDay, slotsCompletedToday);

    return {
      day: d.name,
      planned,
      completed,
      date: dayDateStr,
    };
  });

  const totalPlannedWeek = weeklyChartData.reduce((acc, d) => acc + d.planned, 0);
  const totalCompletedWeek = weeklyChartData.reduce((acc, d) => acc + d.completed, 0);
  const weeklyCompletionPct =
    totalPlannedWeek > 0 ? Math.round((totalCompletedWeek / totalPlannedWeek) * 100) : 0;
  const formatTime12h = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const displayH = h % 12 || 12;
    return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
  };

  // Subscription Status badge helper
  const getSubscriptionBadge = () => {
    const rawExpiry = profile.subscriptionEndDate || profile.subscriptionExpiresAt || profile.trialEndDate;
    if (!rawExpiry) {
      return (
        <button
          type="button"
          onClick={onOpenUpgradeModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>ترقية الاشتراك</span>
        </button>
      );
    }

    const expiry = typeof rawExpiry.toDate === 'function'
      ? rawExpiry.toDate()
      : typeof rawExpiry._seconds === 'number'
      ? new Date(rawExpiry._seconds * 1000)
      : new Date(rawExpiry);

    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (profile.subscriptionStatus === 'trial') {
      return (
        <button
          type="button"
          onClick={onOpenUpgradeModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>تجربة مجانية • متبقي {Math.max(0, diffDays)} أيام</span>
        </button>
      );
    }

    if (profile.subscriptionStatus === 'active') {
      return (
        <button
          type="button"
          onClick={onOpenUpgradeModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-900/80 transition cursor-pointer shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            مشترك نشط 👑 • حتى{' '}
            {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(expiry)}
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onOpenUpgradeModal}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
        <span>الاشتراك منتهي ⚠️ • تجديد الآن</span>
      </button>
    );
  };

  // Handle Smart Absence Confirmation
  const handleConfirmAbsence = async (result: AbsenceDetailsResult) => {
    if (!absenceModalStudent) return;
    const student = absenceModalStudent;
    const todaySlot = schedules.find(
      (s) => s.studentId === student.id && s.dayOfWeek === currentDayOfWeek
    );
    const duration = todaySlot?.duration || 60;
    const hourlyRate = student.hourlyRate || 100;
    const cost = result.isFinancialCounted ? Math.round((duration / 60) * hourlyRate) : 0;

    await addLessonLog(profile.id, student.id, {
      date: todayStr,
      topic: absenceModalTopic.trim() || (absenceModalType === 'excused' ? 'اعتذار مسبق عن موعد الحصة' : 'غياب عن موعد الحصة'),
      homework: '',
      attendance: absenceModalType,
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

    if (todaySlot) {
      await toggleScheduleCompletedToday(profile.id, todaySlot.id, true);
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

    // Only decrement prepaid lessons if it's financially counted
    if (result.isFinancialCounted && student.remainingPaidLessons !== undefined && student.remainingPaidLessons > 0) {
      await updateStudent(profile.id, student.id, {
        remainingPaidLessons: Math.max(0, student.remainingPaidLessons - 1),
      });
    }

    // Trigger Automatic Reminder Notification & Audio Chime
    const remSettings = getStoredReminderSettings();
    triggerAbsenceNotificationAndChime({
      studentName: student.name,
      attendanceType: absenceModalType,
      dateStr: todayStr,
      hasWhatsApp: !!student.whatsapp,
      soundEnabled: remSettings.soundEnabled,
    });

    setAbsenceModalStudent(null);
    setShowStartClassModal(false);
    setClassTopic('');
    setClassHomework('');
    setSelectedStudentId('');
  };

  // Handle Class Registration
  const handleStartClassSubmit = async (sendWhatsApp: boolean) => {
    if (!selectedStudentId || !classTopic.trim()) return;
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    // If attendance is absent or excused, branch to the Smart Modal
    if (attendance === 'absent' || attendance === 'excused') {
      setAbsenceModalStudent(student);
      setAbsenceModalType(attendance);
      setAbsenceModalTopic(classTopic.trim());
      return;
    }

    setSavingClass(true);
    try {
      const todaySlot = schedules.find(
        (s) => s.studentId === student.id && s.dayOfWeek === currentDayOfWeek
      );
      const duration = todaySlot?.duration || 60;
      const hourlyRate = student.hourlyRate || 100;
      const cost = Math.round((duration / 60) * hourlyRate);

      await addLessonLog(profile.id, student.id, {
        date: todayStr,
        topic: classTopic.trim(),
        homework: classHomework.trim(),
        attendance,
        duration,
        hourlyRate,
        cost,
        settled: false,
        rating,
        notes: '',
        isFinancialCounted: true,
        is_financial_counted: true,
        hasMakeupClass: false,
        has_makeup_class: false,
      });

      if (todaySlot) {
        await toggleScheduleCompletedToday(profile.id, todaySlot.id, true);
      }

      // If student has prepaid balance, decrement it automatically
      if (student.remainingPaidLessons !== undefined && student.remainingPaidLessons > 0) {
        await updateStudent(profile.id, student.id, {
          remainingPaidLessons: Math.max(0, student.remainingPaidLessons - 1),
        });
      }

      if (sendWhatsApp && student.whatsapp) {
        const attendanceAr = 'حاضر ✅';
        const msgText =
          `السلام عليكم، تقرير حصة مادة ${profile.subject} للطالب/ـة: ${student.name}\n` +
          `📅 التاريخ: ${todayArabicName} ${dateFormatted}\n` +
          `🎯 الحالة: ${attendanceAr}\n` +
          `📖 ما تم شرحه: ${classTopic.trim()}\n` +
          (classHomework.trim() ? `📝 الواجب المطلوب: ${classHomework.trim()}\n` : '') +
          `⭐ التقييم: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}\n\n` +
          `تحياتي، أ. ${profile.name}`;

        setPendingReportStudent(student);
        setEditableClassReportText(msgText);
        setShowClassReportEditModal(true);
      }

      setShowStartClassModal(false);
      setClassTopic('');
      setClassHomework('');
      setSelectedStudentId('');
    } catch (e) {
      console.error('Error saving class log:', e);
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 text-right" dir="rtl">
      {/* 1. الهيدر والترحيب وشارة الاشتراك */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-black text-white">مرحباً، أ. {profile.name} 👋</h2>
          <p className="text-xs text-purple-200/80 mt-0.5">
            مادة: <span className="font-bold text-amber-300">{profile.subject}</span> •{' '}
            {todayArabicName}، {dateFormatted}
          </p>
        </div>
        <div>{getSubscriptionBadge()}</div>
      </div>

      {/* 2. كارت بنفسجي كبير عنوانه "جدول اليوم" */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-950 p-4 sm:p-5 shadow-2xl border border-purple-500/30 space-y-3.5">
        <div className="flex items-center justify-between border-b border-purple-800/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/40 shadow-inner">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">جدول اليوم</h3>
              <p className="text-[11px] text-purple-200/70">
                {todayArabicName} • {remainingTodayClasses.length} حصص متبقية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDailyAttendanceModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-2 text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer transition active:scale-95"
              title="سجل الحضور والغياب اليومي للطلاب مع التذكيرات التلقائية"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>تسجيل الحضور اليومي 📋</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (students.length > 0 && !selectedStudentId) {
                  setSelectedStudentId(students[0].id);
                }
                setShowStartClassModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>تسجيل حصة</span>
            </button>
          </div>
        </div>

        {/* Live next-class countdown */}
      <div className="rounded-3xl bg-slate-950/80 border border-amber-500/30 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-amber-300 font-black">الحصة القادمة ⏰</p>
            {nextClassInfo ? (
              <>
                <h4 className="text-base font-black text-white mt-1 truncate">
                  {nextClassInfo.slot.studentName}
                </h4>
                <p className="text-[10px] text-slate-300 mt-1">
                  {nextClassInfo.dayLabel} • الساعة {formatTime12h(nextClassInfo.slot.time)} • {nextClassInfo.slot.duration || 60} دقيقة
                </p>
              </>
            ) : (
              <h4 className="text-sm font-bold text-slate-200 mt-1">لا توجد حصة قادمة مجدولة</h4>
            )}
          </div>
          <div className="text-center min-w-[120px] rounded-2xl bg-amber-400/10 border border-amber-400/30 px-3 py-2">
            <p className="text-[9px] text-amber-200 font-bold">متبقي</p>
            <p className="text-lg font-black tracking-wider text-amber-300 tabular-nums" dir="ltr">
              {nextClassInfo ? <LiveCountdown target={nextClassInfo.target} /> : '--:--:--'}
            </p>
          </div>
        </div>
      </div>

      {/* Remaining today's classes content */}
        {remainingTodayClasses.length > 0 ? (
          <div className="space-y-2">
            {remainingTodayClasses.map((slot) => {
              const student = students.find((s) => s.id === slot.studentId);
              const classTypeLabel =
                slot.classType === 'online'
                  ? 'أونلاين 🌐'
                  : slot.classType === 'center'
                  ? 'سنتر 🏫'
                  : slot.classType === 'trial'
                  ? 'تجريبية ✨'
                  : 'حضور شخصي 👤';

              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/20 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center text-xs font-black flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {slot.studentName}
                      </h4>
                      <p className="text-[10px] text-purple-200/80 flex items-center gap-1 mt-0.5">
                        <span className="font-bold text-amber-300">
                          {formatTime12h(slot.time)}
                        </span>
                        <span>•</span>
                        <span>{slot.duration || 60} دقيقة</span>
                        <span>•</span>
                        <span>{classTypeLabel}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(slot.studentId);
                        setAttendance('present');
                        setShowStartClassModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition cursor-pointer shadow flex items-center gap-1"
                      title="تسجيل إنجاز الحصة وحضور الطالب"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>تسجيل</span>
                    </button>

                    {student && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAbsenceModalStudent(student);
                            setAbsenceModalType('excused');
                            setAbsenceModalTopic('اعتذار عن موعد الحصة');
                          }}
                          className="px-2 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition cursor-pointer"
                          title="تسجيل اعتذار الطالب وإدارته مالياً وتعويضياً"
                        >
                          <span>اعتذار ⚠️</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAbsenceModalStudent(student);
                            setAbsenceModalType('absent');
                            setAbsenceModalTopic('غياب بدون إشعار مسبق');
                          }}
                          className="px-2 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300 text-[11px] font-bold transition cursor-pointer"
                          title="تسجيل غياب الطالب وإدارته مالياً وتعويضياً"
                        >
                          <span>غياب ❌</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 space-y-1">
            <h4 className="text-sm font-bold text-amber-300">لا توجد حصص متبقية اليوم 🌟</h4>
            <p className="text-xs text-purple-200/70">
              لا توجد حصص مجدولة لليوم في الجدول الأسبوعي
            </p>
          </div>
        )}
      </div>

      {/* 3. كارت أخضر غامق عريض: "الملخص المالي والأرباح (نظام سعر الساعة)" */}
      <div
        onClick={() => onOpenFinancialDashboard && onOpenFinancialDashboard()}
        className="rounded-3xl bg-gradient-to-r from-emerald-950/90 via-teal-950 to-slate-900 border border-emerald-500/40 p-4 sm:p-5 shadow-xl hover:border-emerald-400/60 transition cursor-pointer space-y-2 relative group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-white">
              الملخص المالي والأرباح (نظام سعر الساعة)
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black shadow-sm">
            جديد 💰
          </span>
        </div>

        <p className="text-xs text-emerald-200/80 leading-relaxed">
          متابعة أرباح الشهر وساعات التدريس والمستحقات المعلقة والتصفية لكل طالب
        </p>

        <div className="flex items-center justify-end pt-1">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:text-emerald-200 transition">
            <span>عرض الحسابات</span>
            <ArrowLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-1 transition" />
          </div>
        </div>
      </div>

      {/* 4. صف من 4 كروت صغيرة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Card 1: الطلاب */}
        <div
          onClick={() => onNavigateToTab(1)}
          className="rounded-2xl bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-3.5 shadow-md transition cursor-pointer space-y-1 text-right"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">الطلاب</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-black text-white">{students.length} طالب</div>
          <p className="text-[10px] text-purple-300/80">الطلاب النشطين</p>
        </div>

        {/* Card 2: حصص اليوم */}
        <div
          onClick={() => onNavigateToTab(2)}
          className="rounded-2xl bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-3.5 shadow-md transition cursor-pointer space-y-1 text-right"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">حصص اليوم</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-black text-white">{todayClasses.length} حصص</div>
          <p className="text-[10px] text-amber-300/80">{todayArabicName}</p>
        </div>

        {/* Card 3: مواعيد ثابتة */}
        <div
          onClick={() => onNavigateToTab(2)}
          className="rounded-2xl bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-3.5 shadow-md transition cursor-pointer space-y-1 text-right"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">مواعيد ثابتة</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg font-black text-white">{schedules.length}</div>
          <p className="text-[10px] text-sky-300/80">موعد أسبوعي</p>
        </div>

        {/* Card 4: الاشتراك */}
        <div
          onClick={onOpenUpgradeModal}
          className="rounded-2xl bg-slate-900/90 border border-purple-500/20 hover:border-purple-500/40 p-3.5 shadow-md transition cursor-pointer space-y-1 text-right"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">الاشتراك</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400">
            {profile.subscriptionStatus === 'active'
              ? 'نشط 👑'
              : profile.subscriptionStatus === 'trial'
              ? 'تجريبي ✨'
              : 'منتهي ⚠️'}
          </div>
          <p className="text-[10px] text-emerald-300/80">تجديد أو ترقية ⬅</p>
        </div>
      </div>

      {/* 5. كارت "روابط سريعة" (وصول فوري للأقسام) - شبكة 3 أعمدة × صفين */}
      <div className="rounded-3xl bg-slate-900/90 border border-purple-500/20 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-2.5">
          <h3 className="text-sm font-black text-white">روابط سريعة</h3>
          <span className="text-[11px] text-purple-300/70">وصول فوري للأقسام</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* 1. مكتبتي */}
          <button
            type="button"
            onClick={() => onNavigateToTab(3)}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 group-hover:text-purple-200 flex items-center justify-center transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              مكتبتي
            </span>
          </button>

          {/* 2. جدول المواعيد */}
          <button
            type="button"
            onClick={() => onNavigateToTab(2)}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 group-hover:text-sky-200 flex items-center justify-center transition">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              جدول المواعيد
            </span>
          </button>

          {/* 3. إضافة طالب */}
          <button
            type="button"
            onClick={() => onNavigateToTab(1)}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 group-hover:text-emerald-200 flex items-center justify-center transition">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              إضافة طالب
            </span>
          </button>

          {/* 4. الإعدادات */}
          <button
            type="button"
            onClick={() => onNavigateToTab(4)}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 group-hover:text-amber-200 flex items-center justify-center transition">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              الإعدادات
            </span>
          </button>

          {/* 5. الاشتراك */}
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 group-hover:text-rose-200 flex items-center justify-center transition">
              <Crown className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              الاشتراك
            </span>
          </button>

          {/* 6. ملاحظات الطلاب */}
          <button
            type="button"
            onClick={() => onNavigateToTab(1)}
            className="p-3 rounded-2xl bg-slate-950/70 hover:bg-purple-950/50 border border-purple-500/20 hover:border-purple-400/50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 group shadow-sm active:scale-95"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 group-hover:text-indigo-200 flex items-center justify-center transition">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white">
              ملاحظات الطلاب
            </span>
          </button>
        </div>
      </div>

      {/* 6. رسم بياني: إنجاز الحصص الأسبوعي مقارنة بالمخطط لها (recharts lazy-loaded) */}
      <React.Suspense fallback={null}>
        <StatsChart
          weeklyChartData={weeklyChartData}
          totalCompletedWeek={totalCompletedWeek}
          totalPlannedWeek={totalPlannedWeek}
          weeklyCompletionPct={weeklyCompletionPct}
        />
      </React.Suspense>

      {/* Start Class Modal */}
      {showStartClassModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">تسجيل تفاصيل الحصة</h3>
              <button
                type="button"
                onClick={() => setShowStartClassModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  اختر الطالب
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white"
                >
                  <option value="" disabled>
                    -- اختر الطالب --
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  حالة الحضور
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttendance('present')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      attendance === 'present'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    حاضر ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const st = students.find((s) => s.id === selectedStudentId);
                      if (st) {
                        setAbsenceModalStudent(st);
                        setAbsenceModalType('absent');
                        setAbsenceModalTopic(classTopic);
                      } else {
                        setAttendance('absent');
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      attendance === 'absent'
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    غائب ❌
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const st = students.find((s) => s.id === selectedStudentId);
                      if (st) {
                        setAbsenceModalStudent(st);
                        setAbsenceModalType('excused');
                        setAbsenceModalTopic(classTopic);
                      } else {
                        setAttendance('excused');
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      attendance === 'excused'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    معتذر ⚠️
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    ما تم شرحه *
                  </label>
                  <VoiceInputButton
                    onTranscript={(transcript) =>
                      setClassTopic((prev) => (prev ? `${prev} ${transcript}` : transcript))
                    }
                    compact
                  />
                </div>
                <textarea
                  value={classTopic}
                  onChange={(e) => setClassTopic(e.target.value)}
                  placeholder="اكتب ما تم شرحه اليوم..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  الواجب المنزلي
                </label>
                <input
                  type="text"
                  value={classHomework}
                  onChange={(e) => setClassHomework(e.target.value)}
                  placeholder="اكتب الواجب المطلوب..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingClass || !selectedStudentId || !classTopic.trim()}
                  onClick={() => handleStartClassSubmit(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition cursor-pointer shadow-lg"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>حفظ وإرسال التقرير عبر واتساب</span>
                </button>
                <button
                  type="button"
                  disabled={savingClass || !selectedStudentId || !classTopic.trim()}
                  onClick={() => handleStartClassSubmit(false)}
                  className="w-full rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/40 py-2 text-xs font-bold text-purple-200 transition"
                >
                  حفظ بدون واتساب
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Before Send Modal for WhatsApp Class Report */}
      {showClassReportEditModal && pendingReportStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>مراجعة تقرير الحصة قبل الإرسال</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowClassReportEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={8}
              value={editableClassReportText}
              onChange={(e) => setEditableClassReportText(e.target.value)}
              className="w-full rounded-2xl bg-slate-950 border border-emerald-500/30 p-3 text-xs text-white leading-relaxed focus:outline-none focus:border-emerald-400"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(editableClassReportText);
                  setCopiedClassReport(true);
                  setTimeout(() => setCopiedClassReport(false), 2000);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {copiedClassReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ التقرير</span>
                  </>
                )}
              </button>

              <a
                href={
                  pendingReportStudent.whatsapp
                    ? `https://wa.me/${pendingReportStudent.whatsapp.replace(
                        /[^0-9]/g,
                        ''
                      )}?text=${encodeURIComponent(editableClassReportText)}`
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(
                        editableClassReportText
                      )}`
                }
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowClassReportEditModal(false)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>إرسال عبر واتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Smart Absence & Makeup Class Details Modal */}
      {absenceModalStudent && (
        <AbsenceDetailsModal
          isOpen={!!absenceModalStudent}
          onClose={() => setAbsenceModalStudent(null)}
          student={absenceModalStudent}
          dateStr={todayStr}
          initialAttendance={absenceModalType}
          profile={profile}
          topic={absenceModalTopic}
          onConfirm={handleConfirmAbsence}
        />
      )}

      {/* Daily Attendance & Absence Register Modal */}
      {showDailyAttendanceModal && (
        <DailyAttendanceModal
          isOpen={showDailyAttendanceModal}
          onClose={() => setShowDailyAttendanceModal(false)}
          profile={profile}
          students={students}
          schedules={schedules}
        />
      )}
    </div>
  );
};
