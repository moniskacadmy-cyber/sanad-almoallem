import {
  ScheduleSlot,
  Student,
  TeacherProfile,
  ReminderLog,
  ReminderSettings,
  renderTemplate,
  DEFAULT_WHATSAPP_TEMPLATES,
} from '../types';
import { auth } from '../firebase';

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
export function showBrowserNotification(title: string, body: string, icon = '/icons/icon-192x192.png') {
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

// Check test reminder daily quota (max 3 times per day)
export function checkTestReminderQuota(): { allowed: boolean; remaining: number } {
  if (typeof localStorage === 'undefined') return { allowed: true, remaining: 3 };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const count = parseInt(localStorage.getItem(`sanad_test_reminders_${today}`) || '0', 10);
    const remaining = Math.max(0, 3 - count);
    return { allowed: remaining > 0, remaining };
  } catch (_e) {
    return { allowed: true, remaining: 3 };
  }
}

export function incrementTestReminderQuota(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const count = parseInt(localStorage.getItem(`sanad_test_reminders_${today}`) || '0', 10);
    localStorage.setItem(`sanad_test_reminders_${today}`, String(count + 1));
  } catch (_e) {}
}

/**
 * Evaluates in-memory schedules locally in the browser with ZERO network calls.
 */
export function checkLocalUpcomingSchedules(params: {
  schedules: ScheduleSlot[];
  students: Student[];
  teacherName?: string;
  teacherWhatsapp?: string;
  minutesBefore?: number;
  now?: Date;
  alertedSlots?: Set<string>;
}): {
  dueReminders: {
    slotId: string;
    slotKey: string;
    studentName: string;
    classTime: string;
    subject: string;
    classType: string;
    locationOrLink?: string;
    whatsappUrl?: string;
    studentPhone?: string;
  }[];
} {
  const {
    schedules = [],
    students = [],
    teacherName = 'المعلم',
    minutesBefore = 15,
    now = new Date(),
    alertedSlots = new Set(),
  } = params;

  const currentDayOfWeek = now.getDay();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDateStr = now.toISOString().slice(0, 10);

  const dueReminders: any[] = [];

  for (const slot of schedules) {
    if (!slot || !slot.time || !slot.time.includes(':')) continue;

    // Check recurrence
    let matchesDay = false;
    if (slot.recurrence === 'daily') {
      matchesDay = true;
    } else if (slot.recurrence === 'once') {
      matchesDay = (slot as any).date === todayDateStr;
    } else {
      // Default: weekly
      matchesDay = slot.dayOfWeek === currentDayOfWeek;
    }

    if (!matchesDay) continue;

    const [h, m] = slot.time.split(':').map(Number);
    const slotTotalMinutes = h * 60 + m;
    const diffMinutes = slotTotalMinutes - currentTotalMinutes;

    // In lookahead window: starting in 0 < diff <= minutesBefore
    const isInWindow = diffMinutes > 0 && diffMinutes <= minutesBefore;
    if (!isInWindow) continue;

    const slotKey = `${slot.id}_${todayDateStr}_${slot.time}`;
    if (alertedSlots.has(slotKey)) continue;

    const student = students.find((s) => s.id === slot.studentId) || {
      id: slot.studentId,
      name: slot.studentName || 'طالب',
      whatsapp: '',
      subject: '',
    };

    const cleanStudentPhone = (student.whatsapp || '').replace(/[^0-9]/g, '');

    dueReminders.push({
      slotId: slot.id,
      slotKey,
      studentName: slot.studentName || student.name || 'طالب',
      classTime: slot.time,
      subject: (student as any).subject || (slot as any).subject || 'المادة',
      classType: slot.classType || 'online',
      locationOrLink: slot.locationOrLink || '',
      studentPhone: student.whatsapp || '',
      whatsappUrl: cleanStudentPhone ? `https://wa.me/${cleanStudentPhone}` : undefined,
    });
  }

  return { dueReminders };
}

// Call /api/reminders/check with the teacher's current schedules and local time
export async function checkRemindersApi(params: {
  teacher: TeacherProfile;
  schedules: ScheduleSlot[];
  students: Student[];
  minutesBefore?: number;
}): Promise<{
  success: boolean;
  checkedCount: number;
  remindersSent: number;
  matchedReminders: ReminderLog[];
}> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/reminders/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
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
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل فحص جدول التذكيرات.');
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error('checkRemindersApi error:', err);
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
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/reminders/status', {
      headers: {
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
    });
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
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/reminders/trigger-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
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


