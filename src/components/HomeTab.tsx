import React, { useState } from 'react';
import { TeacherProfile, Student, ScheduleSlot, ClassType } from '../types';
import { addLessonLog, toggleStudentPaymentStatus, toggleScheduleCompletedToday } from '../firebase';
import { getColorStyle } from './ScheduleTab';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Calendar,
  Users,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
  MessageCircle,
  Star,
  ChevronLeft,
  X,
  CreditCard,
  Video,
  Building,
  UserCheck,
  Check,
  PieChart as PieChartIcon,
  Send,
  FileText,
  Copy,
  DollarSign,
  TrendingUp,
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
  schedules,
  onNavigateToTab,
  onOpenUpgradeModal,
  onOpenFinancialDashboard,
}) => {
  const [showStartClassModal, setShowStartClassModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classTopic, setClassTopic] = useState('');
  const [classHomework, setClassHomework] = useState('');
  const [attendance, setAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const [rating, setRating] = useState<number>(5);
  const [savingClass, setSavingClass] = useState(false);

  // Edit Before Send Modal for Class Report
  const [showClassReportEditModal, setShowClassReportEditModal] = useState(false);
  const [pendingReportStudent, setPendingReportStudent] = useState<Student | null>(null);
  const [editableClassReportText, setEditableClassReportText] = useState('');
  const [copiedClassReport, setCopiedClassReport] = useState(false);

  // Current Arabic date & day
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now); // YYYY-MM-DD
  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayArabicName = arabicDays[currentDayOfWeek];
  const dateFormatted = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Filter and sort today's classes
  const todayClasses = schedules
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Determine completed vs upcoming status for each class
  const evaluatedTodayClasses = todayClasses.map((item) => {
    let startMin = 0;
    let endMin = 0;
    if (item.time && item.time.includes(':')) {
      const [h, m] = item.time.split(':').map(Number);
      startMin = h * 60 + m;
      endMin = startMin + (item.duration || 60);
    }
    const isExplicitlyCompleted = item.completedTodayDate === todayStr;
    const isPastTime = nowMinutes >= endMin;
    const isCompleted = isExplicitlyCompleted || isPastTime;
    const isOngoing = nowMinutes >= startMin && nowMinutes < endMin && !isExplicitlyCompleted;
    const isUpcoming = startMin > nowMinutes && !isExplicitlyCompleted;
    const diffToStart = startMin - nowMinutes;
    const isUpcomingSoon = isUpcoming && diffToStart <= 30;

    return {
      slot: item,
      startMin,
      endMin,
      isCompleted,
      isOngoing,
      isUpcoming,
      diffToStart,
      isUpcomingSoon,
    };
  });

  // Find the next upcoming or ongoing class
  const upcomingOrOngoing = evaluatedTodayClasses.find((c) => c.isOngoing || c.isUpcoming);

  // Calculate subscription remaining days
  const getSubscriptionPill = () => {
    if (!profile.subscriptionExpiresAt) return null;
    const expiry = profile.subscriptionExpiresAt.toDate
      ? profile.subscriptionExpiresAt.toDate()
      : new Date(profile.subscriptionExpiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (profile.subscriptionStatus === 'active') {
      return (
        <div
          onClick={onOpenUpgradeModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer hover:bg-emerald-900/60 transition"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>مشترك حتى {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(expiry)}</span>
        </div>
      );
    }

    if (diffDays <= 0 || profile.subscriptionStatus === 'expired') {
      return (
        <div
          onClick={onOpenUpgradeModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/70 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-900/60 transition"
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          <span>انتهى الاشتراك (تجديد الآن)</span>
        </div>
      );
    }

    return (
      <div
        onClick={onOpenUpgradeModal}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-semibold cursor-pointer hover:bg-purple-900/70 transition"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span>تجريبي (متبقي {diffDays} {diffDays === 1 ? 'يوم' : 'أيام'})</span>
      </div>
    );
  };

  // Payment statistics
  const paidStudents = students.filter((s) => s.paymentStatus === 'paid').length;
  const totalStudents = students.length;

  // Class types distribution for active students
  const privateCount = students.filter((s) => s.classType === 'private').length;
  const onlineCount = students.filter((s) => s.classType === 'online').length;
  const centerCount = students.filter((s) => s.classType === 'center').length;

  const classTypeData = [
    {
      name: 'برايفيت (خاص)',
      shortName: 'برايفيت',
      value: privateCount,
      color: '#a855f7',
    },
    {
      name: 'أونلاين (عن بعد)',
      shortName: 'أونلاين',
      value: onlineCount,
      color: '#38bdf8',
    },
    {
      name: 'سنتر (مجموعة)',
      shortName: 'سنتر',
      value: centerCount,
      color: '#f59e0b',
    },
  ];

  const hasChartData = privateCount > 0 || onlineCount > 0 || centerCount > 0;

  const handleStartClassSubmit = async (sendWhatsApp: boolean) => {
    if (!selectedStudentId || !classTopic.trim()) return;
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setSavingClass(true);
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
      const todaySlot = schedules.find((s) => s.studentId === student.id && s.dayOfWeek === currentDayOfWeek);
      const duration = todaySlot?.duration || 60;
      const hourlyRate = student.hourlyRate || (student.monthlyFee ? Math.round(student.monthlyFee / 4) : 100);
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
      });

      // Mark slot completed today in schedule
      if (todaySlot) {
        await toggleScheduleCompletedToday(profile.id, todaySlot.id, true);
      }

      if (sendWhatsApp && student.whatsapp) {
        const attendanceAr =
          attendance === 'present' ? 'حاضر ✅' : attendance === 'absent' ? 'غائب ❌' : 'معتذر ⚠️';
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
      console.error('Error saving class log', e);
    } finally {
      setSavingClass(false);
    }
  };

  const handleSendClassReportWhatsApp = () => {
    if (!pendingReportStudent?.whatsapp) return;
    const cleanPhone = pendingReportStudent.whatsapp.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(editableClassReportText)}`;
    window.open(url, '_blank');
  };

  const handleCopyClassReport = () => {
    navigator.clipboard.writeText(editableClassReportText);
    setCopiedClassReport(true);
    setTimeout(() => setCopiedClassReport(false), 2000);
  };

  const getClassTypeBadge = (type: ClassType) => {
    switch (type) {
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-300">
            <Video className="w-3 h-3" />
            <span>أونلاين</span>
          </span>
        );
      case 'center':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 text-amber-300">
            <Building className="w-3 h-3" />
            <span>سنتر</span>
          </span>
        );
      case 'private':
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/30 text-purple-300">
            <UserCheck className="w-3 h-3" />
            <span>برايفيت</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header Greeting & Subscription Pill */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">مرحباً، أ. {profile.name} 👋</h2>
          </div>
          <p className="text-xs text-purple-300/80 mt-0.5">
            مادة: <span className="font-semibold text-amber-300">{profile.subject}</span> • {todayArabicName}، {dateFormatted}
          </p>
        </div>
        {getSubscriptionPill()}
      </div>

      {/* Main Action Banner: Smart Upcoming Lesson Countdown */}
      {(() => {
        let badgeText = 'جدول اليوم';
        let mainTitle = 'لا توجد حصص متبقية اليوم 🌟';
        let mainSubtitle = todayClasses.length > 0 ? 'اكتملت جميع حصص اليوم بنجاح، أحسنت عملاً!' : 'لا توجد حصص مجدولة لليوم في الجدول الأسبوعي.';
        let targetStudentId = students.length > 0 ? students[0].id : '';

        if (upcomingOrOngoing) {
          targetStudentId = upcomingOrOngoing.slot.studentId;
          if (upcomingOrOngoing.isOngoing) {
            badgeText = 'حصة جارية الآن 🔴';
            mainTitle = `الحصة الجارية: ${upcomingOrOngoing.slot.studentName}`;
            mainSubtitle = `بدأت الساعة ${upcomingOrOngoing.slot.time} (متبقي ${upcomingOrOngoing.endMin - nowMinutes} دقيقة)`;
          } else {
            const diffM = upcomingOrOngoing.diffToStart;
            const timeStr = diffM >= 60 ? `${Math.floor(diffM / 60)} ساعة و ${diffM % 60} دقيقة` : `${diffM} دقيقة`;
            badgeText = `خلال ${timeStr} ⏰`;
            mainTitle = `الحصة القادمة: ${upcomingOrOngoing.slot.studentName} - خلال ${timeStr}`;
            mainSubtitle = `الساعة ${upcomingOrOngoing.slot.time} • مدة الحصة: ${upcomingOrOngoing.slot.duration || 60} دقيقة`;
          }
        }

        return (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-4 shadow-xl border border-purple-400/30 text-right">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-amber-400 text-slate-950 mb-1.5 shadow">
                  {badgeText}
                </span>
                <h3 className="text-sm font-extrabold text-white truncate">{mainTitle}</h3>
                <p className="text-xs text-purple-200 mt-0.5 leading-relaxed">
                  {mainSubtitle}
                </p>
              </div>
              <button
                onClick={() => {
                  if (targetStudentId) {
                    setSelectedStudentId(targetStudentId);
                  }
                  setShowStartClassModal(true);
                }}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2.5 text-xs font-black shadow-lg shadow-amber-950/40 active:scale-95 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>{upcomingOrOngoing ? 'بدء الحصة' : 'تسجيل حصة'}</span>
              </button>
            </div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-purple-500/20 blur-xl pointer-events-none" />
          </div>
        );
      })()}

      {/* Financial Snapshot Card linking to Financial Dashboard */}
      {onOpenFinancialDashboard && (
        <div
          onClick={onOpenFinancialDashboard}
          className="rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-purple-950/70 border border-emerald-500/35 p-3 flex items-center justify-between cursor-pointer hover:border-emerald-400/50 transition shadow-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 shadow group-hover:scale-105 transition flex-shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white">الملخص المالي والأرباح (نظام سعر الساعة)</h3>
                <span className="text-[9px] px-2 py-0.2 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-bold">
                  جديد 💰
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                متابعة أرباح الشهر وساعات التدريس والمستحقات المعلقة والتصفية لكل طالب
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:translate-x-[-2px] transition flex-shrink-0">
            <span>عرض الحسابات</span>
            <ChevronLeft className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Quick Stats Grid (4 Responsive Cards) */}
      <div className="grid grid-cols-4 gap-2">
        <div
          onClick={() => onNavigateToTab(1)}
          className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-2.5 text-right cursor-pointer hover:border-purple-400/40 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">الطلاب</span>
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-lg font-black text-white">{totalStudents}</p>
          <p className="text-[9px] text-purple-300/80">طالب نشط</p>
        </div>

        <div
          onClick={() => onNavigateToTab(2)}
          className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-2.5 text-right cursor-pointer hover:border-purple-400/40 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">حصص اليوم</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-lg font-black text-white">{todayClasses.length}</p>
          <p className="text-[9px] text-indigo-300/80">{todayArabicName}</p>
        </div>

        <div
          onClick={() => onNavigateToTab(2)}
          className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-2.5 text-right cursor-pointer hover:border-purple-400/40 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">مواعيد ثابتة</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-black text-cyan-300">{schedules.length}</p>
          <p className="text-[9px] text-cyan-200/80">موعد أسبوعي</p>
        </div>

        <div
          onClick={onOpenUpgradeModal}
          className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-2.5 text-right cursor-pointer hover:border-purple-400/40 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">الاشتراك</span>
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xs font-black text-emerald-300 truncate">
            {profile.subscriptionStatus === 'active' ? 'مشترك 💎' : 'تجريبي 🎁'}
          </p>
          <p className="text-[9px] text-emerald-400/80">تجديد أو ترقية</p>
        </div>
      </div>

      {/* Quick Links Grid (روابط سريعة) */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>روابط سريعة</span>
          </h3>
          <span className="text-[10px] text-slate-400">وصول فوري للأقسام</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => onNavigateToTab(1)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">➕</span>
            <span className="font-bold text-[11px]">إضافة طالب</span>
          </button>

          <button
            onClick={() => onNavigateToTab(2)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">📅</span>
            <span className="font-bold text-[11px]">جدول المواعيد</span>
          </button>

          <button
            onClick={() => onNavigateToTab(3)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-blue-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">📖</span>
            <span className="font-bold text-[11px]">مكتبتي</span>
          </button>

          <button
            onClick={() => onNavigateToTab(1)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">📝</span>
            <span className="font-bold text-[11px]">ملاحظات الطلاب</span>
          </button>

          <button
            onClick={onOpenUpgradeModal}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">💳</span>
            <span className="font-bold text-[11px]">الاشتراك</span>
          </button>

          <button
            onClick={() => onNavigateToTab(4)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-200 transition cursor-pointer active:scale-95"
          >
            <span className="text-base mb-1">⚙️</span>
            <span className="font-bold text-[11px]">الإعدادات</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Teachers Community Card */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-purple-950/60 border border-emerald-500/40 p-3.5 space-y-2.5 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 text-emerald-300">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">انضم لمجتمع المعلمين المشتركين على واتساب</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              تبادل الخبرات، بنوك الأسئلة، ونماذج المتابعة مع زملائك من نخبة المعلمين الخصوصيين.
            </p>
          </div>
        </div>

        <a
          href={`https://wa.me/201025967471?text=${encodeURIComponent(
            `مرحباً، أنا أ. ${profile.name} (معلم ${profile.subject}) وأرغب في الانضمام إلى مجتمع معلمي سند المعلم على واتساب.`
          )}`}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-950/40"
        >
          <MessageCircle className="w-4 h-4" />
          <span>انضم للمجموعة الآن 💬</span>
        </a>
      </div>

      {/* Class Types Distribution Card (Recharts) */}
      <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-950/80 border border-purple-500/30 text-purple-300">
              <PieChartIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">توزيع أنواع الحصص للطلاب</h3>
              <p className="text-[11px] text-slate-400">نظرة سريعة على نسب الحصص (أونلاين، سنتر، برايفيت)</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">
            {totalStudents} طالب
          </span>
        </div>

        {hasChartData ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Donut Chart */}
            <div className="w-[135px] h-[125px] flex-shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-purple-500/40 px-2.5 py-1.5 rounded-xl text-right shadow-xl text-xs z-50">
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="text-purple-300">
                              {item.value} طالب ({totalStudents > 0 ? Math.round((item.value / totalStudents) * 100) : 0}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={classTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={54}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#0b0718"
                    strokeWidth={2}
                  >
                    {classTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPie>
              </ResponsiveContainer>
              {/* Inner Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-black text-white">{totalStudents}</span>
                <span className="text-[8px] text-slate-400">طالب</span>
              </div>
            </div>

            {/* Custom Interactive Legend / Summary Badges */}
            <div className="flex-1 space-y-1.5">
              {classTypeData.map((item) => {
                const percent = totalStudents > 0 ? Math.round((item.value / totalStudents) * 100) : 0;
                return (
                  <div
                    key={item.shortName}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-200">{item.shortName}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{item.value}</span>
                      <span className="text-[10px] text-slate-400">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <p>لا توجد بيانات طلاب لعرض الرسم البياني حتى الآن.</p>
            <p className="text-[11px] text-purple-300/80 mt-0.5">أضف طلابك لتوزيعهم بين أونلاين، سنتر، وبرايفيت.</p>
          </div>
        )}
      </div>

      {/* Today's Schedule Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">جدول حصص اليوم ({todayArabicName})</h3>
          </div>
          <button
            onClick={() => onNavigateToTab(2)}
            className="text-xs text-purple-300 hover:text-white flex items-center gap-0.5 cursor-pointer"
          >
            <span>كل المواعيد</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayClasses.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/30 flex items-center justify-center mx-auto mb-2 text-purple-400">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-200">لا توجد حصص مجدولة لليوم!</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              وقت رائع للراحة أو تحضير الدروس، أو يمكنك إضافة موعد حصة جديد للجدول.
            </p>
            <button
              onClick={() => onNavigateToTab(2)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-600/50 transition cursor-pointer"
            >
              <span>إضافة موعد جديد</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {evaluatedTodayClasses.map((evalItem) => {
              const item = evalItem.slot;
              const matchedStudent = students.find((s) => s.id === item.studentId);
              const colorInfo = getColorStyle(item.color);
              const isCompleted = evalItem.isCompleted;
              const isUpcomingSoon = evalItem.isUpcomingSoon;
              const diffMins = evalItem.diffToStart;

              // Build pre-filled 15-minute reminder message for WhatsApp
              let whatsappReminderUrl = '';
              if (matchedStudent?.whatsapp) {
                const cleanPhone = matchedStudent.whatsapp.replace(/[^0-9]/g, '');
                const fullPhone = cleanPhone.startsWith('01') ? '2' + cleanPhone : cleanPhone;
                const classTypeAr =
                  item.classType === 'online'
                    ? 'أونلاين (عن بُعد)'
                    : item.classType === 'center'
                    ? 'في السنتر (مجموعة)'
                    : 'برايفيت (حضور خاص)';
                const msg =
                  `👋 مرحباً ولي أمر الطالب/ـة: *${item.studentName}*\n\n` +
                  `🔔 نود تذكيركم بأن موعد حصة *${matchedStudent.subject || profile.subject}* مع الأستاذ/ـة *${profile.name}* ستبدأ بعد *15 دقيقة* (الساعة ${item.time}).\n` +
                  `📌 نوع الحصة: ${classTypeAr}\n` +
                  (item.locationOrLink ? `🔗 الرابط / المكان: ${item.locationOrLink}\n` : '') +
                  `\nنتمنى له/لها حصة دراسية موفقة وممتعة! 📚✨\n` +
                  `— منصة سند المعلم`;
                whatsappReminderUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
              }

              return (
                <div
                  key={item.id}
                  style={{ borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : colorInfo.border }}
                  className={`rounded-2xl border p-3.5 flex items-center justify-between transition shadow-md ${
                    isCompleted
                      ? 'bg-slate-900/60 opacity-80 border-emerald-500/30'
                      : isUpcomingSoon
                      ? 'bg-slate-900/90 ring-1 ring-amber-500/50 shadow-amber-950/30'
                      : 'bg-slate-900/80 hover:border-purple-400/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        backgroundColor: isCompleted ? 'rgba(6, 78, 59, 0.5)' : colorInfo.bg,
                        borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : colorInfo.border,
                      }}
                      className="w-10 h-10 rounded-xl border flex flex-col items-center justify-center font-mono text-xs font-bold"
                    >
                      <span style={{ color: isCompleted ? '#34d399' : colorInfo.text }}>
                        {isCompleted ? '✓' : item.time}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={`text-sm font-bold ${
                            isCompleted ? 'line-through text-slate-300 decoration-emerald-400' : 'text-white'
                          }`}
                        >
                          {item.studentName}
                        </h4>
                        {getClassTypeBadge(item.classType)}

                        {isCompleted ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                            <span>تمت الحصة ✅</span>
                          </span>
                        ) : isUpcomingSoon ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse font-bold">
                            خلال {diffMins} دقيقة ⏰
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        الساعة: {item.time} • المدة: {item.duration} دقيقة {item.locationOrLink && `• ${item.locationOrLink}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Attendance / Completed Toggle Button */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleScheduleCompletedToday(profile.id, item.id, !item.completedTodayDate)
                      }
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        item.completedTodayDate
                          ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-800/40'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
                      }`}
                      title={item.completedTodayDate ? 'إلغاء وسم تمت الحصة' : 'تسجيل حضور / تمت الحصة'}
                    >
                      <CheckCircle className={`w-4 h-4 ${item.completedTodayDate ? 'text-emerald-400' : ''}`} />
                    </button>

                    {!isCompleted && whatsappReminderUrl && (
                      <a
                        href={whatsappReminderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-2 rounded-xl border transition flex items-center gap-1 ${
                          isUpcomingSoon
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 animate-pulse'
                            : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'
                        }`}
                        title="إرسال تذكير الحصة (قبل 15 دقيقة) عبر واتساب"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {isUpcomingSoon && <span className="text-[10px] font-bold hidden sm:inline">تذكير</span>}
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setSelectedStudentId(item.studentId);
                        setShowStartClassModal(true);
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                        isCompleted
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          : 'bg-purple-600 hover:bg-purple-500'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>{isCompleted ? 'تفاصيل' : 'بدء'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Start Class Modal */}
      {showStartClassModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-base font-bold text-white">تسجيل تفاصيل الحصة</h3>
              </div>
              <button
                onClick={() => setShowStartClassModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اختر الطالب</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="" disabled>
                    -- اختر من قائمة الطلاب --
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Attendance */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">حالة الحضور</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttendance('present')}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      attendance === 'present'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    حاضر ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendance('absent')}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      attendance === 'absent'
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    غائب ❌
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendance('excused')}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      attendance === 'excused'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    معتذر ⚠️
                  </button>
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ما تم شرحه في الحصة *
                </label>
                <textarea
                  value={classTopic}
                  onChange={(e) => setClassTopic(e.target.value)}
                  placeholder="مثال: شرح درس المعادلات من الدرجة الثانية وحل تمارين 1 و 2..."
                  rows={2}
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Homework */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  الواجب المطلوب (اختياري)
                </label>
                <input
                  type="text"
                  value={classHomework}
                  onChange={(e) => setClassHomework(e.target.value)}
                  placeholder="مثال: حل صفحة 45 من كراسة التدريبات"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  تقييم استيعاب الطالب اليوم
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRating(num)}
                      className="p-1 cursor-pointer transition hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          num <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 mr-2">
                    {rating === 5 ? 'ممتاز جداً 🌟' : rating >= 4 ? 'جيد جداً' : rating >= 3 ? 'متوسط' : 'يحتاج تركيز'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingClass || !selectedStudentId || !classTopic.trim()}
                  onClick={() => handleStartClassSubmit(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>حفظ وإرسال التقرير لولي الأمر عبر واتساب</span>
                </button>
                <button
                  type="button"
                  disabled={savingClass || !selectedStudentId || !classTopic.trim()}
                  onClick={() => handleStartClassSubmit(false)}
                  className="w-full rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/40 py-2 text-xs font-bold text-purple-200 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span>حفظ في سجل الطالب فقط (بدون واتساب)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Class Report Before Send */}
      {showClassReportEditModal && pendingReportStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 text-right">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">معاينة وتعديل تقرير الحصة لولي الأمر</h3>
                  <p className="text-[10px] text-slate-400">
                    الطالب/ـة: {pendingReportStudent.name} • {pendingReportStudent.whatsapp ? `واتساب: ${pendingReportStudent.whatsapp}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClassReportEditModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              يمكنك مراجعة وتعديل نص التقرير بحرية قبل الضغط على زر الإرسال عبر الواتساب:
            </p>

            {/* Editable Textarea */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={editableClassReportText}
                onChange={(e) => setEditableClassReportText(e.target.value)}
                rows={9}
                className="w-full rounded-2xl bg-slate-950/90 border border-emerald-500/30 focus:border-emerald-400 p-3.5 text-xs text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition resize-y"
                placeholder="نص التقرير..."
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendClassReportWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>إرسال التقرير عبر واتساب الآن 💬</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyClassReport}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  {copiedClassReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedClassReport ? 'تم النسخ بنجاح!' : 'نسخ النص'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClassReportEditModal(false)}
                  className="flex items-center justify-center py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
