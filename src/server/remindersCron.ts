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

  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

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
    try {
      const {
        schedules = [],
        students = [],
        teacherId = 'teacher',
        teacherName = 'المعلم',
        teacherWhatsapp = '',
        clientTime,
        minutesBefore = 15,
      } = req.body;

      const authUserUid = (req as any).user?.uid;
      if (authUserUid && teacherId && teacherId !== authUserUid) {
        return res.status(403).json({ error: 'غير مصرح به: لا يمكنك فحص بيانات معلم آخر.' });
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
