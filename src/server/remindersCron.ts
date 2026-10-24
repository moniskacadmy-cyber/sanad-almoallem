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


// Send an approved WhatsApp Cloud API template message.
// This is required for business-initiated reminders when the app is closed.
export async function sendWhatsAppReminderTemplate(params: {
  to: string;
  studentName: string;
  subject: string;
  classTime: string;
  locationOrLink?: string;
}): Promise<{ configured: boolean; sent: boolean; error?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim();
  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE?.trim();
  const languageCode = process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE?.trim() || 'ar';
  const to = formatWhatsAppPhone(params.to);

  if (!accessToken || !phoneNumberId || !graphVersion || !templateName) {
    return { configured: false, sent: false, error: 'WhatsApp Cloud API غير مهيأ بالكامل.' };
  }
  if (!to) {
    return { configured: true, sent: false, error: 'رقم واتساب المعلم غير صالح.' };
  }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.studentName || 'الطالب' },
            { type: 'text', text: params.subject || 'المادة' },
            { type: 'text', text: params.classTime || '--:--' },
            { type: 'text', text: params.locationOrLink || 'غير محدد' },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const providerMessage = typeof data?.error?.message === 'string' ? data.error.message : 'WhatsApp API rejected the message.';
      return { configured: true, sent: false, error: providerMessage.slice(0, 500) };
    }
    return { configured: true, sent: true };
  } catch (error) {
    return {
      configured: true,
      sent: false,
      error: error instanceof Error ? error.message.slice(0, 500) : 'تعذر الاتصال بخدمة واتساب.',
    };
  }
}
// Helper to format class type in Arabic
export function getClassTypeArabic(type: string): string {
  switch (type) {
    case 'online':
      return 'أونلاين (عن بُعد 🌐)';
    case 'in_person':
      return 'حضور شخصي 👤';
    case 'trial':
      return 'حصة تجريبية ✨';
    case 'center':
      return 'حضور شخصي (في السنتر 🏫)';
    case 'private':
      return 'حضور شخصي (برايفيت 👤)';
    default:
      return type || 'حصة دراسية';
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

// Core check function: Evaluates timetable slots that start in ~15 minutes (stateless calculation)
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

  let currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  let currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const weekdayStr = getPart('weekday');
    const hour = (Number.parseInt(getPart('hour'), 10) || 0) % 24;
    const minute = (Number.parseInt(getPart('minute'), 10) || 0) % 60;
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    if (weekdayStr in weekdayMap) {
      currentDayOfWeek = weekdayMap[weekdayStr];
    }
    currentTotalMinutes = hour * 60 + minute;
  } catch (_) {}

  const matchedReminders: ReminderLogItem[] = [];

  for (const slot of schedules) {
    if (slot.dayOfWeek !== currentDayOfWeek) {
      continue;
    }

    if (!slot.time || !slot.time.includes(':')) {
      continue;
    }

    const [slotHour, slotMin] = slot.time.split(':').map(Number);
    const slotTotalMinutes = slotHour * 60 + slotMin;
    const diffMinutes = slotTotalMinutes - currentTotalMinutes;

    // Match if class starts within the target window (minutesBefore - 1 to minutesBefore)
    const isIn15MinWindow = diffMinutes >= (minutesWindow - 1) && diffMinutes <= minutesWindow;

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

      // 2. Prepare Teacher Reminder
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
    }
  }

  return {
    matchedReminders,
    summary: {
      checked: schedules.length,
      sent: matchedReminders.length,
    },
  };
}

// Upper bounds for the stateless /check endpoint (a teacher's real data is far smaller).
const MAX_CHECK_SCHEDULES = 1000;
const MAX_CHECK_STUDENTS = 2000;

// Create Express API Router (Purely client-driven, no background intervals or in-memory arrays)
export function createRemindersRouter(): Router {
  const router = Router();

  // 1. Cron status info endpoint
  router.all('/cron', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'نظام التذكيرات يعمل من خلال العميل وتطبيق المتصفح مباشرة.',
      clientDriven: true,
      recentLogs: [],
    });
  });

  // 2. Schedule Check Endpoint (stateless evaluation for active teacher on client trigger)
  router.post('/check', (req: Request, res: Response) => {
    // Wrap in a safe handler to ensure JSON response always
    try {
      // Identity comes ONLY from the verified ID token; any teacherId in the body is ignored.
      const authUserUid = (req as any).user?.uid as string | undefined;
      if (!authUserUid) {
        return res.status(401).json({ success: false, error: 'غير مصرح به: يلزم تسجيل الدخول.' });
      }
      const teacherId = authUserUid;

      const {
        schedules = [],
        students = [],
        teacherName = 'المعلم',
        teacherWhatsapp = '',
        clientTime,
        minutesBefore = 15,
      } = req.body ?? {};

      // Bound the work a single request can make the server do.
      if (!Array.isArray(schedules) || !Array.isArray(students)) {
        return res.status(400).json({ success: false, error: 'صيغة البيانات غير صحيحة.' });
      }
      if (schedules.length > MAX_CHECK_SCHEDULES || students.length > MAX_CHECK_STUDENTS) {
        return res.status(400).json({ success: false, error: 'حجم البيانات المرسلة أكبر من المسموح.' });
      }

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

      return res.status(200).json({
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
        success: false,
        error: 'حدث خطأ أثناء فحص جدول المواعيد.',
      });
    }
  });

  // 3. Status Endpoint (Stateless, client-driven reminders)
  router.get('/status', (_req: Request, res: Response) => {
    return res.json({
      isRunning: false,
      clientDriven: true,
      intervalMinutes: 15,
      lastRun: null,
      nextRun: null,
      totalDispatched: 0,
      recentLogs: [],
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
      console.error('Error in /api/reminders/trigger-test:', err);
      return res.status(500).json({ error: 'فشل توليد التذكير التجريبي.' });
    }
  });

  return router;
}
