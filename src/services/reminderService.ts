import {
  ScheduleSlot,
  Student,
  TeacherProfile,
  ReminderLog,
  ReminderSettings,
  renderTemplate,
  DEFAULT_WHATSAPP_TEMPLATES,
  isInDoNotDisturbPeriod,
} from '../types';
import { getAuthenticatedHeaders } from './authHelper';

const REMINDER_SETTINGS_KEY = 'sanad_reminder_settings';
const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  minutesBefore: 15,
  notifyTeacher: true,
  notifyParent: true,
  soundEnabled: true,
  autoOpenWhatsApp: false,
  endOfDaySummaryEnabled: true,
  endOfDaySummaryTime: '21:00',
  dailyDigestEnabled: true,
  dailyDigestTime: '08:00',
};

// Play a pleasant two-tone audio alert using Web Audio API
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Web Audio chime could not play:', e);
  }
}

// Request Native Web Notification Permission
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Show OS/Browser Notification
export function showBrowserNotification(title: string, body: string, icon = '/pwa-192x192.png') {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon,
        dir: 'rtl',
        badge: icon,
        tag: 'class-reminder',
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn('Failed to display browser notification:', e);
    }
  }
}

// Get saved reminder settings
export function getStoredReminderSettings(): ReminderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

// Save reminder settings
export function storeReminderSettings(settings: ReminderSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to store reminder settings:', e);
  }
}

// Call /api/reminders/check with the teacher's current schedules and local time
export async function checkRemindersApi(
  params: {
    teacher: TeacherProfile;
    schedules: ScheduleSlot[];
    students: Student[];
    minutesBefore?: number;
  },
  attempt = 1
): Promise<{
  success: boolean;
  checkedCount: number;
  remindersSent: number;
  matchedReminders: ReminderLog[];
}> {
  // Respect Do Not Disturb settings (quiet hours, weekends, or vacation mode)
  if (isInDoNotDisturbPeriod(params.teacher?.doNotDisturb)) {
    return { success: true, checkedCount: 0, remindersSent: 0, matchedReminders: [] };
  }

  // فحص حالة الإنترنت أولاً لمنع إرسال طلبات فاشلة وتسجيل أخطاء في الـ Console
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { success: false, checkedCount: 0, remindersSent: 0, matchedReminders: [] };
  }

  const MAX_RETRIES = 2;

  try {
    const headers = await getAuthenticatedHeaders();
    if (!headers || !('Authorization' in headers)) {
      return { success: false, checkedCount: 0, remindersSent: 0, matchedReminders: [] };
    }

    const response = await fetch('/api/reminders/check', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        teacherId: params.teacher.id,
        teacherName: params.teacher.name,
        teacherWhatsapp: params.teacher.whatsapp,
        schedules: params.schedules,
        students: params.students,
        clientTime: new Date().toISOString(),
        minutesBefore: params.minutesBefore || 15,
      }),
    });

    if (!response.ok) {
      return { success: false, checkedCount: 0, remindersSent: 0, matchedReminders: [] };
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    const errorMessage = err.message || '';

    // عدم إعادة المحاولة وإرجاع النتيجة بهدوء عند أخطاء الشبكة
    if (
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('ERR_CONNECTION_CLOSED') ||
      errorMessage.includes('ERR_NAME_NOT_RESOLVED')
    ) {
      return { success: false, checkedCount: 0, remindersSent: 0, matchedReminders: [] };
    }

    if (attempt < MAX_RETRIES && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      return checkRemindersApi(params, attempt + 1);
    }

    return {
      success: false,
      checkedCount: 0,
      remindersSent: 0,
      matchedReminders: [],
    };
  }
}

// Fetch Cron status and logs from server
export async function fetchCronStatusApi(): Promise<{
  isRunning: boolean;
  intervalMinutes: number;
  lastRun: string | null;
  nextRun: string | null;
  totalDispatched: number;
  recentLogs: ReminderLog[];
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      isRunning: true,
      intervalMinutes: 15,
      lastRun: null,
      nextRun: null,
      totalDispatched: 0,
      recentLogs: [],
    };
  }

  try {
    const headers = await getAuthenticatedHeaders();
    const res = await fetch('/api/reminders/status', { headers });
    if (res.status === 401) {
       return {
         isRunning: true,
         intervalMinutes: 15,
         lastRun: null,
         nextRun: null,
         totalDispatched: 0,
         recentLogs: []
       };
    }
    if (!res.ok) throw new Error('فشل جلب حالة Cron Job.');
    return await res.json();
  } catch (e) {
    return {
      isRunning: true,
      intervalMinutes: 15,
      lastRun: null,
      nextRun: null,
      totalDispatched: 0,
      recentLogs: [],
    };
  }
}

// Asks the server to push "notifications are on + today's classes" to the teacher's phone right after sign-in.
// The server sends it at most once per 6 hours and respects Do-Not-Disturb; failures are silent on purpose.
export async function sendLoginSummaryApi(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    const headers = await getAuthenticatedHeaders();
    await fetch('/api/reminders/login-summary', { method: 'POST', headers });
  } catch (e) {
    console.warn('Login summary notification skipped:', e);
  }
}

// Trigger manual test reminder
export async function triggerTestReminderApi(params: {
  studentName: string;
  teacherName: string;
  subject: string;
  classTime: string;
  studentWhatsapp: string;
  teacherWhatsapp: string;
  locationOrLink?: string;
}) {
  const headers = await getAuthenticatedHeaders();
  const res = await fetch('/api/reminders/trigger-test', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error('فشل إرسال التذكير التجريبي.');
  }
  return await res.json();
}

// End-of-Day Summary Report Helpers
export interface EndOfDaySummaryResult {
  sent: boolean;
  reason?: string;
  completedCount: number;
  totalScheduledCount: number;
  completedStudentNames: string[];
  message: string;
}

export function generateEndOfDaySummaryMessage(params: {
  teacherName: string;
  completedCount: number;
  totalScheduledCount: number;
  completedStudentNames: string[];
}): { title: string; body: string } {
  const { teacherName, completedCount, totalScheduledCount, completedStudentNames } = params;
  const title = '📊 تقرير نهاية اليوم - سند المعلم';

  if (completedCount > 0) {
    const studentsStr =
      completedStudentNames.length > 0
        ? `مع الطلاب: (${completedStudentNames.slice(0, 3).join('، ')}${
            completedStudentNames.length > 3 ? ' وغيرهم' : ''
          })`
        : '';
    const body = `أحسنت أ. ${teacherName}! 🌟 تم إنجاز ${completedCount} من أصل ${totalScheduledCount} حصص مجدولة اليوم بنجاح ${studentsStr}. ارتح جيداً واستعد ليوم مثمر غداً! 📚✨`;
    return { title, body };
  }

  if (totalScheduledCount > 0) {
    const body = `أ. ${teacherName}، كان لديك ${totalScheduledCount} حصص مجدولة اليوم ولم تسجل أي حصة كمنجزة بعد. تذكّر تسجيل تقارير الطلاب لضبط الحسابات! 📝`;
    return { title, body };
  }

  const body = `أ. ${teacherName}، يوم هادئ بدون حصص مجدولة اليوم ☕. نتمنى لك وقتاً ممتعاً وأمسية سعيدة!`;
  return { title, body };
}

export function sendEndOfDaySummaryNotification(params: {
  teacher: TeacherProfile;
  schedules: ScheduleSlot[];
  students: Student[];
  force?: boolean;
}): EndOfDaySummaryResult {
  const { teacher, schedules, force = false } = params;
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
  const currentDayOfWeek = now.getDay();
  const eodKey = `sanad_eod_sent_${teacher.id}_${todayStr}`;

  if (!force) {
    const alreadySent = localStorage.getItem(eodKey);
    if (alreadySent) {
      return {
        sent: false,
        reason: 'already_sent_today',
        completedCount: 0,
        totalScheduledCount: 0,
        completedStudentNames: [],
        message: 'تم إرسال تقرير نهاية اليوم مسبقاً لهذا اليوم.',
      };
    }
  }

  // Calculate today's completed and scheduled classes
  const todaySlots = schedules.filter((s) => s.dayOfWeek === currentDayOfWeek);
  const completedSlots = todaySlots.filter((s) => s.completedTodayDate === todayStr);
  const completedStudentNames = completedSlots.map((s) => s.studentName).filter(Boolean);

  const { title, body } = generateEndOfDaySummaryMessage({
    teacherName: teacher.name,
    completedCount: completedSlots.length,
    totalScheduledCount: todaySlots.length,
    completedStudentNames,
  });

  showBrowserNotification(title, body);
  playNotificationChime();

  if (!force) {
    localStorage.setItem(eodKey, new Date().toISOString());
  }

  return {
    sent: true,
    completedCount: completedSlots.length,
    totalScheduledCount: todaySlots.length,
    completedStudentNames,
    message: body,
  };
}

// Daily Scheduled Digest Notification Helpers
export function generateDailyDigestMessage(params: {
  schedules: ScheduleSlot[];
  students?: Student[];
}): { title: string; body: string; count: number } {
  const { schedules } = params;
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday

  // Filter today's slots and sort chronologically by time
  const todaySlots = schedules
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => {
      const [ha, ma] = (a.time || '00:00').split(':').map(Number);
      const [hb, mb] = (b.time || '00:00').split(':').map(Number);
      return (ha * 60 + ma) - (hb * 60 + mb);
    });

  const count = todaySlots.length;

  if (count === 0) {
    return {
      title: 'جدول اليوم - سند المعلم ☕',
      body: 'ليس لديك حصص مجدولة اليوم. نتمنى لك يوماً سعيداً ومريحاً!',
      count: 0,
    };
  }

  // Format times e.g. 18:00 -> 6:00 م
  const formatTime12h = (time24: string) => {
    if (!time24 || !time24.includes(':')) return time24;
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  // Build class list items e.g. "عائشة (6:00 م)"
  const classItems = todaySlots.map((slot) => {
    const timeFormatted = formatTime12h(slot.time);
    return `${slot.studentName || 'حصة'} (${timeFormatted})`;
  });

  const title = `عندك ${count} ${count === 1 ? 'حصة' : count === 2 ? 'حصتان' : count <= 10 ? 'حصص' : 'حصة'} اليوم`;
  const body = classItems.join('، ');

  return { title, body, count };
}

export function sendDailyDigestNotification(params: {
  teacher: TeacherProfile;
  schedules: ScheduleSlot[];
  students: Student[];
  force?: boolean;
}): { sent: boolean; title: string; body: string; count: number } {
  const { teacher, schedules, students, force = false } = params;
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
  const digestKey = `sanad_daily_digest_sent_${teacher.id}_${todayStr}`;

  if (!force) {
    // This phone/browser is registered for server push (works even when the app is closed): the server
    // sends the digest, so do not show a second one here.
    if (localStorage.getItem('sanad_fcm_uid') === teacher.id) {
      return { sent: false, title: '', body: 'يصل ملخص اليوم من السيرفر على إشعارات الهاتف.', count: 0 };
    }
    const alreadySent = localStorage.getItem(digestKey);
    if (alreadySent) {
      return { sent: false, title: '', body: 'تم إرسال تذكير الجدول اليومي مسبقاً اليوم.', count: 0 };
    }
  }

  // Check Do Not Disturb settings
  if (isInDoNotDisturbPeriod(teacher.doNotDisturb)) {
    return { sent: false, title: '', body: 'وضع عدم الإزعاج نشط.', count: 0 };
  }

  const { title, body, count } = generateDailyDigestMessage({ schedules, students });

  showBrowserNotification(title, body);
  playNotificationChime();

  if (!force) {
    localStorage.setItem(digestKey, new Date().toISOString());
  }

  return { sent: true, title, body, count };
}

// Student Absence Automatic Reminder Generator & Notification Dispatcher
export function createAbsenceReminderMessage(params: {
  student: Student;
  teacher: TeacherProfile;
  dateStr: string;
  attendanceType: 'absent' | 'excused';
  isFinancialCounted: boolean;
  hasMakeupClass: boolean;
  makeupClassDate?: string | null;
  notes?: string;
  topic?: string;
}): string {
  const isExcused = params.attendanceType === 'excused';
  const statusLabel = isExcused ? 'اعتذار مسبق عن موعد الحصة ⚠️' : 'غياب عن موعد الحصة ❌';

  let dateFormatted = params.dateStr;
  try {
    dateFormatted = new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(params.dateStr));
  } catch {
    dateFormatted = params.dateStr;
  }

  let financialNote = '';
  if (params.isFinancialCounted) {
    financialNote = '• الجانب المالي: تم احتساب الحصة ضمن السجل المالي للمتابعة الدراسية.';
  } else {
    financialNote = '• الجانب المالي: لم يتم احتساب هذه الحصة مالياً مراعاةً للظرف والاعتذار.';
  }

  let makeupNote = '';
  if (params.hasMakeupClass) {
    if (params.makeupClassDate) {
      makeupNote = `• الحصة التعويضية: تم تحديد موعد الحصة التعويضية بإذن الله بتاريخ (${params.makeupClassDate}).`;
    } else {
      makeupNote = '• الحصة التعويضية: سيتم التنسيق معكم قريباً لتحديد موعد حصة تعويضية مناسبة لضمان عدم تأخر الطالب في المنهج.';
    }
  } else {
    makeupNote = '• الحصة التعويضية: لا توجد حصة تعويضية مقررة لهذه الحصة.';
  }

  const extraNotes = params.notes?.trim() ? `• ملاحظات إضافية: ${params.notes.trim()}` : '';

  const template =
    params.teacher.whatsappTemplates?.absenceReminder ||
    DEFAULT_WHATSAPP_TEMPLATES.absenceReminder;

  return renderTemplate(template, {
    studentName: params.student.name,
    subject: params.teacher.subject,
    teacherName: params.teacher.name,
    date: dateFormatted,
    statusLabel,
    financialNote,
    makeupNote,
    extraNotes,
    topic: params.topic || '',
  });
}

export function triggerAbsenceNotificationAndChime(params: {
  studentName: string;
  attendanceType: 'absent' | 'excused';
  dateStr: string;
  hasWhatsApp?: boolean;
  soundEnabled?: boolean;
}) {
  const isExcused = params.attendanceType === 'excused';
  const title = isExcused ? '⚠️ تنبيه اعتذار طالب - سند المعلم' : '❌ تنبيه غياب طالب - سند المعلم';
  const body = `تم تسجيل ${isExcused ? 'اعتذار' : 'غياب'} الطالب/ـة (${params.studentName}) وتفعيل التذكير التلقائي لولي الأمر بنجاح.`;
  showBrowserNotification(title, body);
  if (params.soundEnabled !== false) {
    playNotificationChime();
  }
}
