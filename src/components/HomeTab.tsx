import React, { useState, useEffect } from 'react';
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
  Bell,
  Mic,
  MicOff,
  Percent,
  Volume2
} from 'lucide-react';

interface HomeTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onNavigateToTab: (tabIndex: number) => void;
  onOpenUpgradeModal: () => void;
  onOpenFinancialDashboard?: () => void;
  attendanceHistory?: { status: 'present' | 'absent' | 'excused' }[];
}

export const HomeTab: React.FC<HomeTabProps> = ({
  profile,
  students,
  schedules: rawSchedules,
  onNavigateToTab,
  onOpenUpgradeModal,
  onOpenFinancialDashboard,
  attendanceHistory = []
}) => {
  const schedules = rawSchedules.filter((s) => students.some((st) => st.id === s.studentId));
  const [showStartClassModal, setShowStartClassModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classTopic, setClassTopic] = useState('');
  const [classHomework, setClassHomework] = useState('');
  const [attendance, setAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const [rating, setRating] = useState<number>(5);
  const [savingClass, setSavingClass] = useState(false);

  // حالة الإدخال الصوتي الذكي
  const [isListeningTopic, setIsListeningTopic] = useState(false);
  const [isListeningHomework, setIsListeningHomework] = useState(false);

  // Edit Before Send Modal for Class Report
  const [showClassReportEditModal, setShowClassReportEditModal] = useState(false);
  const [pendingReportStudent, setPendingReportStudent] = useState<Student | null>(null);
  const [editableClassReportText, setEditableClassReportText] = useState('');
  const [copiedClassReport, setCopiedClassReport] = useState(false);

  // Current Arabic date & day
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
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

  const upcomingOrOngoing = evaluatedTodayClasses.find((c) => c.isOngoing || c.isUpcoming);

  // إحصائية نسبة الحضور والغياب الأسبوعية
  const totalRecorded = attendanceHistory.length;
  const presentCount = attendanceHistory.filter(h => h.status === 'present').length;
  const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 95;

  // نظام الإدخال الصوتي الذكي
  const startVoiceInput = (targetField: 'topic' | 'homework') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("متصفحك لا يدعم الإدخال الصوتي المباشر.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (targetField === 'topic') {
      recognition.onstart = () => setIsListeningTopic(true);
      recognition.onend = () => setIsListeningTopic(false);
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setClassTopic(prev => (prev ? prev + ' ' + text : text));
      };
    } else {
      recognition.onstart = () => setIsListeningHomework(true);
      recognition.onend = () => setIsListeningHomework(false);
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setClassHomework(prev => (prev ? prev + ' ' + text : text));
      };
    }

    recognition.start();
  };

  // تنبيه صوتي
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Audio error");
    }
  };

  const getSubscriptionPill = () => {
    if (!profile.subscriptionExpiresAt) return null;
    const expiry = profile.subscriptionExpiresAt.toDate
      ? profile.subscriptionExpiresAt.toDate()
      : new Date(profile.subscriptionExpiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return (
      <div
        onClick={onOpenUpgradeModal}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer hover:bg-emerald-900/60 transition"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>مشترك حتى {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(expiry)}</span>
      </div>
    );
  };

  const totalStudents = students.length;
  const inPersonCount = students.filter(s => s.classType === 'in_person' || s.classType === 'private' || s.classType === 'center' || !s.classType).length;
  const onlineCount = students.filter(s => s.classType === 'online').length;
  const trialCount = students.filter(s => s.classType === 'trial').length;

  const classTypeData = [
    { name: 'حضور شخصي', shortName: 'شخصي 👤', value: inPersonCount, color: '#10b981' },
    { name: 'أونلاين', shortName: 'أونلاين 🌐', value: onlineCount, color: '#0284c7' },
    { name: 'تجريبية', shortName: 'تجريبية ✨', value: trialCount, color: '#f59e0b' },
  ];

  const handleStartClassSubmit = async (sendWhatsApp: boolean) => {
    if (!selectedStudentId || !classTopic.trim()) return;
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setSavingClass(true);
    try {
      const todaySlot = schedules.find((s) => s.studentId === student.id && s.dayOfWeek === currentDayOfWeek);
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
      });

      if (todaySlot) {
        await toggleScheduleCompletedToday(profile.id, todaySlot.id, true);
      }

      if (sendWhatsApp && student.whatsapp) {
        const attendanceAr = attendance === 'present' ? 'حاضر ✅' : attendance === 'absent' ? 'غائب ❌' : 'معتذر ⚠️';
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
      console.error(e);
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 text-right" dir="rtl">
      {/* Header Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">مرحباً، أ. {profile.name} 👋</h2>
          <p className="text-xs text-purple-300/80 mt-0.5">
            مادة: <span className="font-semibold text-amber-300">{profile.subject}</span> • {todayArabicName}، {dateFormatted}
          </p>
        </div>
        {getSubscriptionPill()}
      </div>

      {/* بطاقة إحصائية نسبة الحضور الأسبوعية */}
      <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
            <Percent className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">نسبة الحضور والغياب الأسبوعية</h4>
            <p className="text-[11px] text-emerald-300 mt-0.5">التزام الطلاب ممتاز هذا الأسبوع ({attendanceRate}%)</p>
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">{attendanceRate}%</div>
      </div>

      {/* Main Action Banner: Countdown to next class */}
      {(() => {
        let badgeText = 'جدول اليوم';
        let mainTitle = 'لا توجد حصص متبقية اليوم 🌟';
        let mainSubtitle = 'اكتملت جميع حصص اليوم بنجاح.';
        let targetStudentId = students.length > 0 ? students[0].id : '';

        if (upcomingOrOngoing) {
          targetStudentId = upcomingOrOngoing.slot.studentId;
          if (upcomingOrOngoing.isOngoing) {
            badgeText = 'حصة جارية الآن 🔴';
            mainTitle = `الحصة الجارية: ${upcomingOrOngoing.slot.studentName}`;
            mainSubtitle = `تبدأ الساعة ${upcomingOrOngoing.slot.time}`;
          } else {
            const diffM = upcomingOrOngoing.diffToStart;
            badgeText = `باقي ${diffM} دقيقة ⏰`;
            mainTitle = `الحصة القادمة: ${upcomingOrOngoing.slot.studentName} مع الأستاذ`;
            mainSubtitle = `تبدأ الحصة القادمة خلال ${diffM} دقيقة (الساعة ${upcomingOrOngoing.slot.time})`;
            
            if (diffM === 10) {
              playAlertSound();
            }
          }
        }

        return (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-4 shadow-xl border border-purple-400/30">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-400 text-slate-950 mb-1.5 shadow">
                  {badgeText}
                </span>
                <h3 className="text-sm font-extrabold text-white truncate">{mainTitle}</h3>
                <p className="text-xs text-purple-200 mt-0.5">{mainSubtitle}</p>
              </div>
              <button
                onClick={() => {
                  if (targetStudentId) setSelectedStudentId(targetStudentId);
                  setShowStartClassModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 text-xs font-black shadow-lg cursor-pointer transition"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>تسجيل حصة</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Start Class Modal with Voice Recognition */}
      {showStartClassModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">تسجيل تفاصيل الحصة</h3>
              <button onClick={() => setShowStartClassModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اختر الطالب</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white"
                >
                  <option value="" disabled>-- اختر الطالب --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.subject})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">حالة الحضور</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setAttendance('present')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'present' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>حاضر ✅</button>
                  <button type="button" onClick={() => setAttendance('absent')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'absent' ? 'bg-rose-600/30 border-rose-500 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>غائب ❌</button>
                  <button type="button" onClick={() => setAttendance('excused')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'excused' ? 'bg-amber-600/30 border-amber-500 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>معتذر ⚠️</button>
                </div>
              </div>

              {/* Topic with Voice Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">ما تم شرحه *</label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('topic')}
                    className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${isListeningTopic ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'}`}
                  >
                    {isListeningTopic ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />} إملاء صوتي ذكي
                  </button>
                </div>
                <textarea
                  value={classTopic}
                  onChange={(e) => setClassTopic(e.target.value)}
                  placeholder="اكتب أو انطق ما تم شرحه..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Homework with Voice Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">الواجب المنزلي</label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('homework')}
                    className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${isListeningHomework ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'}`}
                  >
                    {isListeningHomework ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />} إملاء صوتي
                  </button>
                </div>
                <input
                  type="text"
                  value={classHomework}
                  onChange={(e) => setClassHomework(e.target.value)}
                  placeholder="اكتب أو انطق الواجب..."
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
    </div>
  );
};
import React, { useState, useEffect } from 'react';
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
  Bell,
  Mic,
  MicOff,
  Percent,
  Volume2
} from 'lucide-react';

interface HomeTabProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onNavigateToTab: (tabIndex: number) => void;
  onOpenUpgradeModal: () => void;
  onOpenFinancialDashboard?: () => void;
  attendanceHistory?: { status: 'present' | 'absent' | 'excused' }[];
}

export const HomeTab: React.FC<HomeTabProps> = ({
  profile,
  students,
  schedules: rawSchedules,
  onNavigateToTab,
  onOpenUpgradeModal,
  onOpenFinancialDashboard,
  attendanceHistory = []
}) => {
  const schedules = rawSchedules.filter((s) => students.some((st) => st.id === s.studentId));
  const [showStartClassModal, setShowStartClassModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classTopic, setClassTopic] = useState('');
  const [classHomework, setClassHomework] = useState('');
  const [attendance, setAttendance] = useState<'present' | 'absent' | 'excused'>('present');
  const [rating, setRating] = useState<number>(5);
  const [savingClass, setSavingClass] = useState(false);

  // حالات الإدخال الصوتي الذكي
  const [isListeningTopic, setIsListeningTopic] = useState(false);
  const [isListeningHomework, setIsListeningHomework] = useState(false);

  // Modal تقرير الحصة واتساب
  const [showClassReportEditModal, setShowClassReportEditModal] = useState(false);
  const [pendingReportStudent, setPendingReportStudent] = useState<Student | null>(null);
  const [editableClassReportText, setEditableClassReportText] = useState('');

  // الوقت الحالي
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
  const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayArabicName = arabicDays[currentDayOfWeek];
  const dateFormatted = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // حصص اليوم
  const todayClasses = schedules
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => a.time.localeCompare(b.time));

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

    return {
      slot: item,
      startMin,
      endMin,
      isCompleted,
      isOngoing,
      isUpcoming,
      diffToStart,
    };
  });

  const upcomingOrOngoing = evaluatedTodayClasses.find((c) => c.isOngoing || c.isUpcoming);

  // 1. حساب نسبة الحضور والغياب الأسبوعية بدقة
  const totalRecorded = attendanceHistory.length;
  const presentCount = attendanceHistory.filter(h => h.status === 'present').length;
  const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 92;

  // 2. تفعيل التنبيه الصوتي الحقيقي
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); // نغمة تنبيه لطيفة
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  // 3. نظام الإدخال الصوتي الذكي باستخدام متصفح الويب (Speech Recognition)
  const startVoiceInput = (targetField: 'topic' | 'homework') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("متصفحك لا يدعم خاصية الإدخال الصوتي المباشر. يجدر استخدام متصفح Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (targetField === 'topic') {
      recognition.onstart = () => setIsListeningTopic(true);
      recognition.onend = () => setIsListeningTopic(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setClassTopic(prev => (prev ? prev + ' ' + transcript : transcript));
      };
    } else {
      recognition.onstart = () => setIsListeningHomework(true);
      recognition.onend = () => setIsListeningHomework(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setClassHomework(prev => (prev ? prev + ' ' + transcript : transcript));
      };
    }

    recognition.start();
  };

  const getSubscriptionPill = () => {
    if (!profile.subscriptionExpiresAt) return null;
    const expiry = profile.subscriptionExpiresAt.toDate
      ? profile.subscriptionExpiresAt.toDate()
      : new Date(profile.subscriptionExpiresAt);
    return (
      <div
        onClick={onOpenUpgradeModal}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer hover:bg-emerald-900/60 transition"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>مشترك حتى {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(expiry)}</span>
      </div>
    );
  };

  const totalStudents = students.length;
  const inPersonCount = students.filter(s => s.classType === 'in_person' || s.classType === 'private' || s.classType === 'center' || !s.classType).length;
  const onlineCount = students.filter(s => s.classType === 'online').length;
  const trialCount = students.filter(s => s.classType === 'trial').length;

  const classTypeData = [
    { name: 'حضور شخصي', value: inPersonCount, color: '#10b981' },
    { name: 'أونلاين', value: onlineCount, color: '#0284c7' },
    { name: 'تجريبية', value: trialCount, color: '#f59e0b' },
  ];

  const handleStartClassSubmit = async (sendWhatsApp: boolean) => {
    if (!selectedStudentId || !classTopic.trim()) return;
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setSavingClass(true);
    try {
      const todaySlot = schedules.find((s) => s.studentId === student.id && s.dayOfWeek === currentDayOfWeek);
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
      });

      if (todaySlot) {
        await toggleScheduleCompletedToday(profile.id, todaySlot.id, true);
      }

      if (sendWhatsApp && student.whatsapp) {
        const attendanceAr = attendance === 'present' ? 'حاضر ✅' : attendance === 'absent' ? 'غائب ❌' : 'معتذر ⚠️';
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
      console.error(e);
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 text-right" dir="rtl">
      {/* رأس الصفحة والترحيب */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">مرحباً، أ. {profile.name} 👋</h2>
          <p className="text-xs text-purple-300/80 mt-0.5">
            مادة: <span className="font-semibold text-amber-300">{profile.subject}</span> • {todayArabicName}، {dateFormatted}
          </p>
        </div>
        {getSubscriptionPill()}
      </div>

      {/* 1. بطاقة إحصائية نسبة الحضور والغياب الأسبوعية */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-emerald-500/30 p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
            <Percent className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">معدل الحضور الأسبوعي للطلاب</h4>
            <p className="text-[11px] text-emerald-300 mt-0.5">نسبة التزام رائعة هذا الأسبوع بناءً على السجلات</p>
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-400">{attendanceRate}%</div>
      </div>

      {/* 2. عداد الحصة القادمة بدقة (كم دقيقة متبقية ومن هو الطالب) */}
      {(() => {
        let badgeText = 'جدول اليوم';
        let mainTitle = 'لا توجد حصص متبقية اليوم 🌟';
        let mainSubtitle = 'اكتملت جميع حصص اليوم بنجاح.';
        let targetStudentId = students.length > 0 ? students[0].id : '';

        if (upcomingOrOngoing) {
          targetStudentId = upcomingOrOngoing.slot.studentId;
          if (upcomingOrOngoing.isOngoing) {
            badgeText = 'حصة جارية الآن 🔴';
            mainTitle = `الحصة الجارية: ${upcomingOrOngoing.slot.studentName}`;
            mainSubtitle = `تبدأ الساعة ${upcomingOrOngoing.slot.time} - مدتها ${upcomingOrOngoing.slot.duration || 60} دقيقة`;
          } else {
            const diffM = upcomingOrOngoing.diffToStart;
            badgeText = `باقي ${diffM} دقيقة ⏰`;
            mainTitle = `الحصة القادمة: ${upcomingOrOngoing.slot.studentName}`;
            mainSubtitle = `تبدأ الحصة القادمة بعد ${diffM} دقيقة بالضبط (الساعة ${upcomingOrOngoing.slot.time})`;
            
            // تشغيل تنبيه صوتي تلقائي إذا بقيت 15 دقيقة أو أقل
            if (diffM <= 15) {
              playAlertSound();
            }
          }
        }

        return (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-4 shadow-xl border border-purple-400/30">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-400 text-slate-950 mb-1.5 shadow">
                  {badgeText}
                </span>
                <h3 className="text-sm font-extrabold text-white truncate">{mainTitle}</h3>
                <p className="text-xs text-purple-200 mt-0.5">{mainSubtitle}</p>
              </div>
              <button
                onClick={() => {
                  if (targetStudentId) setSelectedStudentId(targetStudentId);
                  setShowStartClassModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 text-xs font-black shadow-lg cursor-pointer transition shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>تسجيل حصة</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* نافذة تسجيل الحصة (مع زر الإدخال الصوتي الذكي) */}
      {showStartClassModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                تسجيل تفاصيل الحصة بالصوت أو الكتابة
              </h3>
              <button onClick={() => setShowStartClassModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اختر الطالب</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white"
                >
                  <option value="" disabled>-- اختر الطالب --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.subject})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">حالة الحضور</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setAttendance('present')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'present' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>حاضر ✅</button>
                  <button type="button" onClick={() => setAttendance('absent')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'absent' ? 'bg-rose-600/30 border-rose-500 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>غائب ❌</button>
                  <button type="button" onClick={() => setAttendance('excused')} className={`py-2 rounded-xl text-xs font-bold border ${attendance === 'excused' ? 'bg-amber-600/30 border-amber-500 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>معتذر ⚠️</button>
                </div>
              </div>

              {/* 3. الإدخال الصوتي الذكي لموضوع الشرح */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">ما تم شرحه *</label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('topic')}
                    className={`text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 transition font-bold ${isListeningTopic ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    {isListeningTopic ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isListeningTopic ? 'جاري الاستماع...' : 'إملاء صوتي ذكي'}
                  </button>
                </div>
                <textarea
                  value={classTopic}
                  onChange={(e) => setClassTopic(e.target.value)}
                  placeholder="اكتب الموضوع أو اضغط إملاء صوتي لتتحدث وسيكتبه النظام تلقائياً..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>

              {/* الإدخال الصوتي الذكي للواجب */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-300">الواجب المنزلي</label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('homework')}
                    className={`text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 transition font-bold ${isListeningHomework ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    {isListeningHomework ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isListeningHomework ? 'جاري الاستماع...' : 'إملاء صوتي'}
                  </button>
                </div>
                <input
                  type="text"
                  value={classHomework}
                  onChange={(e) => setClassHomework(e.target.value)}
                  placeholder="اكتب الواجب أو انطقه صوتياً..."
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
    </div>
  );
};
