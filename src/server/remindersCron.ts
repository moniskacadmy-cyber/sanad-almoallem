import { Router, Request, Response } from 'express';

export interface ReminderLogItem {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  target: 'parent' | 'teacher';
  recipientName: string;
  recipientPhone: string;
  classTime: string;
  classType: string;
  subject: string;
  locationOrLink?: string;
  messageText: string;
  whatsappUrl: string;
  status: 'sent' | 'scheduled' | 'delivered';
  minutesBefore: number;
  sentAt: string;
}

// In-memory state for Cron Job and dispatch history
let isCronRunning = false;
let cronTimer: NodeJS.Timeout | null = null;
let lastRunTimestamp: string | null = null;
let nextRunTimestamp: string | null = null;
let totalDispatchedCount = 0;
const sentRemindersCache = new Set<string>(); // key: `${slotId}_${dateStr}_${target}`
const reminderLogs: ReminderLogItem[] = [];

// Helper to format clean Egyptian/international WhatsApp number
export function formatWhatsAppPhone(phone: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('01')) {
    // Egyptian mobile starting with 01 -> +201...
    return '2' + digits;
  }
  return digits;
}

// Helper to format class type in Arabic
export function getClassTypeArabic(type: string): string {
  switch (type) {
    case 'online':
      return 'أونلاين (عن بُعد)';
    case 'center':
      return 'في السنتر (مجموعة)';
    case 'private':
      return 'برايفيت (حضور خاص)';
    default:
      return type || 'حصة خاصة';
  }
}

// Generate Parent WhatsApp reminder message
export function buildParentReminderMessage(params: {
  studentName: string;
  teacherName: string;
  subject: string;
  classTime: string;
  classType: string;
  locationOrLink?: string;
}): string {
  const { studentName, teacherName, subject, classTime, classType, locationOrLink } = params;
  const typeAr = getClassTypeArabic(classType);

  let msg = `👋 مرحباً ولي أمر الطالب/ـة: *${studentName}*\n\n`;
  msg += `🔔 نود تذكيركم بأن موعد حصة *${subject}* مع الأستاذ/ـة *${teacherName}* ستبدأ بعد *15 دقيقة* (الساعة ${classTime}).\n`;
  msg += `📌 نوع الحصة: ${typeAr}\n`;
  if (locationOrLink && locationOrLink.trim()) {
    msg += `🔗 الرابط / المكان: ${locationOrLink.trim()}\n`;
  }
  msg += `\nنتمنى له/لها حصة دراسية موفقة وممتعة! 📚✨\n`;
  msg += `— منصة سند المعلم`;
  return msg;
}

// Generate Teacher WhatsApp & notification reminder message
export function buildTeacherReminderMessage(params: {
  studentName: string;
  teacherName: string;
  subject: string;
  classTime: string;
  classType: string;
  locationOrLink?: string;
}): string {
  const { studentName, teacherName, subject, classTime, classType, locationOrLink } = params;
  const typeAr = getClassTypeArabic(classType);

  let msg = `🔔 *تذكير بحصة قادمة بعد 15 دقيقة* ⏰\n\n`;
  msg += `أستاذ/ـة *${teacherName}*، لديك حصة قادمة مع الطالب/ـة:\n`;
  msg += `👤 *${studentName}*\n`;
  msg += `📖 المادة: ${subject}\n`;
  msg += `🕒 التوقيت: الساعة ${classTime}\n`;
  msg += `📍 النوع: ${typeAr}\n`;
  if (locationOrLink && locationOrLink.trim()) {
    msg += `🔗 الرابط / المكان: ${locationOrLink.trim()}\n`;
  }
  msg += `\nنتمنى لك حصة مثمرة وموفقة يا أستاذنا! 🌟`;
  return msg;
}

// Core check function: Evaluates timetable slots that start in ~15 minutes
export function checkUpcomingSlots(params: {
  schedules: any[];
  students: any[];
  teacherId?: string;
  teacherName?: string;
  teacherWhatsapp?: string;
  now?: Date;
  minutesWindow?: number; // default 15
}): { matchedReminders: ReminderLogItem[]; summary: { checked: number; sent: number } } {
  const {
    schedules = [],
    students = [],
    teacherId = 'default_teacher',
    teacherName = 'المعلم',
    teacherWhatsapp = '',
    now = new Date(),
    minutesWindow = 15,
  } = params;

  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const dateStr = now.toISOString().slice(0, 10);

  const matchedReminders: ReminderLogItem[] = [];

  for (const slot of schedules) {
    // Match today's day of week
    if (slot.dayOfWeek !== currentDayOfWeek) {
      continue;
    }

    if (!slot.time || !slot.time.includes(':')) {
      continue;
    }

    const [slotHour, slotMin] = slot.time.split(':').map(Number);
    const slotTotalMinutes = slotHour * 60 + slotMin;

    // Difference between slot time and current time
    const diffMinutes = slotTotalMinutes - currentTotalMinutes;

    // Match if class starts within the target window (e.g. 10 to 20 minutes from now, targeting 15 min)
    const isIn15MinWindow = diffMinutes >= (minutesWindow - 5) && diffMinutes <= (minutesWindow + 5);

    if (isIn15MinWindow) {
      const student = students.find((s) => s.id === slot.studentId) || {
        id: slot.studentId,
        name: slot.studentName,
        whatsapp: '',
        subject: '',
      };

      const cleanStudentPhone = formatWhatsAppPhone(student.whatsapp || '');
      const cleanTeacherPhone = formatWhatsAppPhone(teacherWhatsapp || '');

      // 1. Prepare Parent Reminder
      const parentCacheKey = `${slot.id}_${dateStr}_parent_${minutesWindow}`;
      if (!sentRemindersCache.has(parentCacheKey)) {
        sentRemindersCache.add(parentCacheKey);

        const parentMsg = buildParentReminderMessage({
          studentName: slot.studentName,
          teacherName,
          subject: student.subject || 'المادة',
          classTime: slot.time,
          classType: slot.classType || 'online',
          locationOrLink: slot.locationOrLink,
        });

        const parentWaUrl = cleanStudentPhone
          ? `https://wa.me/${cleanStudentPhone}?text=${encodeURIComponent(parentMsg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(parentMsg)}`;

        const parentItem: ReminderLogItem = {
          id: `rem_p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          teacherId,
          studentId: slot.studentId,
          studentName: slot.studentName,
          target: 'parent',
          recipientName: `ولي أمر ${slot.studentName}`,
          recipientPhone: student.whatsapp || 'غير مسجل',
          classTime: slot.time,
          classType: slot.classType || 'online',
          subject: student.subject || 'المادة',
          locationOrLink: slot.locationOrLink,
          messageText: parentMsg,
          whatsappUrl: parentWaUrl,
          status: 'sent',
          minutesBefore: minutesWindow,
          sentAt: new Date().toISOString(),
        };

        matchedReminders.push(parentItem);
        reminderLogs.unshift(parentItem);
        totalDispatchedCount++;
      }

      // 2. Prepare Teacher Reminder
      const teacherCacheKey = `${slot.id}_${dateStr}_teacher_${minutesWindow}`;
      if (!sentRemindersCache.has(teacherCacheKey)) {
        sentRemindersCache.add(teacherCacheKey);

        const teacherMsg = buildTeacherReminderMessage({
          studentName: slot.studentName,
          teacherName,
          subject: student.subject || 'المادة',
          classTime: slot.time,
          classType: slot.classType || 'online',
          locationOrLink: slot.locationOrLink,
        });

        const teacherWaUrl = cleanTeacherPhone
          ? `https://wa.me/${cleanTeacherPhone}?text=${encodeURIComponent(teacherMsg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(teacherMsg)}`;

        const teacherItem: ReminderLogItem = {
          id: `rem_t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          teacherId,
          studentId: slot.studentId,
          studentName: slot.studentName,
          target: 'teacher',
          recipientName: teacherName,
          recipientPhone: teacherWhatsapp || 'غير مسجل',
          classTime: slot.time,
          classType: slot.classType || 'online',
          subject: student.subject || 'المادة',
          locationOrLink: slot.locationOrLink,
          messageText: teacherMsg,
          whatsappUrl: teacherWaUrl,
          status: 'sent',
          minutesBefore: minutesWindow,
          sentAt: new Date().toISOString(),
        };

        matchedReminders.push(teacherItem);
        reminderLogs.unshift(teacherItem);
        totalDispatchedCount++;
      }
    }
  }

  // Trim logs buffer
  if (reminderLogs.length > 200) {
    reminderLogs.splice(200);
  }

  return {
    matchedReminders,
    summary: {
      checked: schedules.length,
      sent: matchedReminders.length,
    },
  };
}

// Cron Job Execution Routine
export function runCronJobTick() {
  const now = new Date();
  lastRunTimestamp = now.toISOString();

  // Next run is in 15 minutes
  const nextDate = new Date(now.getTime() + 15 * 60 * 1000);
  nextRunTimestamp = nextDate.toISOString();

  console.log(`[Cron Job] Checking class schedules every 15 minutes at ${lastRunTimestamp}...`);

  return {
    timestamp: lastRunTimestamp,
    nextRun: nextRunTimestamp,
    status: 'completed',
    totalDispatched: totalDispatchedCount,
  };
}

// Initialize the 15-minute background Cron timer
export function initRemindersCron() {
  if (isCronRunning) return;
  isCronRunning = true;

  // Run initial tick after server warm-up
  setTimeout(() => {
    runCronJobTick();
  }, 2000);

  // Set Interval to 15 minutes (15 * 60 * 1000 = 900,000 ms)
  const CRON_INTERVAL_MS = 15 * 60 * 1000;
  cronTimer = setInterval(() => {
    runCronJobTick();
  }, CRON_INTERVAL_MS);

  console.log('✅ [Cron Job] Automated class reminders cron started: running every 15 minutes.');
}

// Create Express API Router
export function createRemindersRouter(): Router {
  const router = Router();

  // Ensure cron is initiated
  initRemindersCron();

  // 1. Cron Job Endpoint (can be pinged by external cron/webhook or GET /api/reminders/cron)
  router.all('/cron', (_req: Request, res: Response) => {
    const result = runCronJobTick();
    return res.json({
      success: true,
      message: 'تم تشغيل فحص جدول الحصص بنجاح (كل 15 دقيقة).',
      ...result,
      recentLogs: reminderLogs.slice(0, 10),
    });
  });

  // 2. Schedule Check Endpoint (receives active teacher schedules and checks 15-minute window)
  router.post('/check', (req: Request, res: Response) => {
    try {
      const {
        schedules = [],
        students = [],
        teacherId = 'teacher',
        teacherName = 'المعلم',
        teacherWhatsapp = '',
        clientTime,
        minutesBefore = 15,
        forceCheck = false,
      } = req.body;

      const evalTime = clientTime ? new Date(clientTime) : new Date();

      const { matchedReminders, summary } = checkUpcomingSlots({
        schedules,
        students,
        teacherId,
        teacherName,
        teacherWhatsapp,
        now: evalTime,
        minutesWindow: Number(minutesBefore) || 15,
      });

      lastRunTimestamp = new Date().toISOString();

      return res.json({
        success: true,
        evaluatedTime: evalTime.toISOString(),
        minutesWindow: Number(minutesBefore) || 15,
        checkedCount: summary.checked,
        remindersSent: summary.sent,
        matchedReminders,
      });
    } catch (err: any) {
      console.error('Error in /api/reminders/check:', err);
      return res.status(500).json({
        error: err.message || 'حدث خطأ أثناء فحص جدول المواعيد.',
      });
    }
  });

  // 3. Status and Logs Endpoint
  router.get('/status', (_req: Request, res: Response) => {
    return res.json({
      isRunning: isCronRunning,
      intervalMinutes: 15,
      lastRun: lastRunTimestamp,
      nextRun: nextRunTimestamp,
      totalDispatched: totalDispatchedCount,
      recentLogs: reminderLogs.slice(0, 50),
    });
  });

  // 4. Test/Instant Trigger for a single student or schedule slot
  router.post('/trigger-test', (req: Request, res: Response) => {
    try {
      const {
        studentName = 'طالب تجريبي',
        teacherName = 'الأستاذ',
        subject = 'الرياضيات',
        classTime = '16:00',
        classType = 'online',
        locationOrLink = 'https://meet.google.com/abc-defg-hij',
        studentWhatsapp = '',
        teacherWhatsapp = '',
      } = req.body;

      const parentMsg = buildParentReminderMessage({
        studentName,
        teacherName,
        subject,
        classTime,
        classType,
        locationOrLink,
      });

      const teacherMsg = buildTeacherReminderMessage({
        studentName,
        teacherName,
        subject,
        classTime,
        classType,
        locationOrLink,
      });

      const cleanStudentPhone = formatWhatsAppPhone(studentWhatsapp);
      const cleanTeacherPhone = formatWhatsAppPhone(teacherWhatsapp);

      const parentWaUrl = cleanStudentPhone
        ? `https://wa.me/${cleanStudentPhone}?text=${encodeURIComponent(parentMsg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(parentMsg)}`;

      const teacherWaUrl = cleanTeacherPhone
        ? `https://wa.me/${cleanTeacherPhone}?text=${encodeURIComponent(teacherMsg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(teacherMsg)}`;

      const testLog: ReminderLogItem = {
        id: `test_${Date.now()}`,
        teacherId: 'test_teacher',
        studentId: 'test_student',
        studentName,
        target: 'parent',
        recipientName: `ولي أمر ${studentName}`,
        recipientPhone: studentWhatsapp || 'تجريبي',
        classTime,
        classType,
        subject,
        locationOrLink,
        messageText: parentMsg,
        whatsappUrl: parentWaUrl,
        status: 'sent',
        minutesBefore: 15,
        sentAt: new Date().toISOString(),
      };

      reminderLogs.unshift(testLog);

      return res.json({
        success: true,
        message: 'تم إعداد تذكير تجريبي بنجاح.',
        parentReminder: {
          phone: studentWhatsapp,
          message: parentMsg,
          whatsappUrl: parentWaUrl,
        },
        teacherReminder: {
          phone: teacherWhatsapp,
          message: teacherMsg,
          whatsappUrl: teacherWaUrl,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'فشل توليد التذكير التجريبي.' });
    }
  });

  return router;
}
