export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type SubscriptionPlan = 'none' | 'monthly' | 'three_months' | 'six_months' | 'yearly' | 'custom';
export type ClassType = 'online' | 'in_person' | 'trial' | 'private' | 'center';
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type PaymentStatus = 'paid' | 'unpaid';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'once';

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  subject: string;
  role: 'teacher' | 'admin';
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  isActive?: boolean;
  subscriptionEndDate?: any; // Firestore Timestamp
  trialStartDate: any; // Firestore Timestamp
  trialEndDate: any;   // Firestore Timestamp
  subscriptionExpiresAt: any; // Firestore Timestamp
  currency?: string; // العملة المفضلة (مثال: ج.م، ر.س، د.إ)
  whatsappTemplates?: {
    welcome?: string;
    payment?: string;
    report?: string;
    lessonPrep?: string;
  };
  createdAt: any;
  updatedAt: any;
}

export interface SubscriptionRecord {
  id: string;
  email: string;
  isActive: boolean;
  subscriptionEndDate: any;
  plan?: string;
  teacherName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Student {
  id: string;
  teacherId: string;
  name: string;
  whatsapp?: string;
  subject: string;
  classType: ClassType;
  hourlyRate: number; // سعر الساعة (Hourly Rate)
  monthlyFee?: number; // legacy backward compatibility
  pendingDues?: number; // المستحقات المعلقة غير المدفوعة
  totalHours?: number; // إجمالي الساعات المنفذة
  collectedDues?: number; // المبالغ المحصلة
  lastSettledAt?: any; // تاريخ آخر تصفية
  paymentStatus?: PaymentStatus;
  lastPaymentMonth?: string;
  learningStyle?: string;
  notes?: string;
  color?: string;
  createdAt: any;
  updatedAt: any;
}

export interface LessonLog {
  id: string;
  studentId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  topic: string; // ما تم شرحه
  homework?: string; // الواجب
  attendance: AttendanceStatus;
  duration?: number; // مدة الحصة بالدقائق
  hourlyRate?: number; // سعر الساعة للحصة
  cost?: number; // قيمة الحصة = (duration / 60) * hourlyRate
  settled?: boolean; // هل تم تصفية حساب هذه الحصة
  settledAt?: any; // تاريخ التصفية
  rating?: number; // 1 - 5
  notes?: string;
  createdAt: any;
}

export interface ScheduleSlot {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  dayOfWeek: number; // 0: الأحد, 1: الإثنين, 2: الثلاثاء, 3: الأربعاء, 4: الخميس, 5: الجمعة, 6: السبت
  time: string; // HH:MM
  duration: number; // minutes
  recurrence: RecurrenceType;
  classType: ClassType;
  color?: string;
  locationOrLink?: string;
  completedTodayDate?: string; // YYYY-MM-DD إذا تم تعليم الحصة كمنجزة اليوم
  createdAt: any;
  updatedAt: any;
}

export type LibraryItemType = 'lesson_plan' | 'quiz' | 'summary' | 'pdf' | 'image' | 'book';

export interface LibraryItem {
  id: string;
  teacherId: string;
  title: string;
  type: LibraryItemType;
  subject?: string;
  content: string;
  fileName?: string;
  fileSize?: string;
  fileData?: string;
  createdAt: any;
  updatedAt: any;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  app: string;
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  lessons: Record<string, LessonLog[]>; // studentId -> LessonLog[]
  libraryItems: LibraryItem[];
}

export interface AdminStats {
  totalTeachers: number;
  activeSubscribers: number;
  inTrial: number;
  expired: number;
}

export type ReminderTarget = 'parent' | 'teacher';
export type ReminderStatus = 'sent' | 'scheduled' | 'delivered';

export interface ReminderLog {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  target: ReminderTarget;
  recipientPhone: string;
  recipientName: string;
  classTime: string;
  classType: ClassType;
  subject: string;
  locationOrLink?: string;
  status: ReminderStatus;
  messageText: string;
  whatsappUrl: string;
  sentAt: string;
  minutesBefore: number;
}

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number; // 15
  notifyTeacher: boolean;
  notifyParent: boolean;
  soundEnabled: boolean;
  autoOpenWhatsApp?: boolean;
}

export const DEFAULT_WHATSAPP_TEMPLATES = {
  welcome: `السلام عليكم ورحمة الله وبركاته 🌷\nمرحباً بك معنا في رحلتنا التعليمية لمادة ({subject})! يسعدني جداً انضمام الطالب/ـة: {studentName} معنا.\nسنبذل قصارى جهدنا لتحقيق التفوق والتميز الدراسي إن شاء الله. 📚✨`,
  payment: `السلام عليكم ورحمة الله وبركاته 🌷\n🧾 كشف حساب ومطالبة مالية - مادة ({subject})\n\n👤 الطالب/ـة: {studentName}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n\n📊 تفاصيل المستحقات الحالية:\n• سعر الساعة: {hourlyRate} {currency}/ساعة\n• عدد الساعات المنفذة: {pendingHours} ساعة ({unsettledCount} حصص غير مصفاة)\n• إجمالي المستحقات المطلوبة: {pendingAmount} {currency} 💰\n\n{lessonsList}\n\nشاكرين ومقدرين لكم حسن التعاون والاهتمام الدائم 🌟`,
  report: `السلام عليكم ورحمة الله وبركاته 🌷\nتقرير المتابعة الشهري لشهر ({month})\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 المعلم: أ. {teacherName}\n\n📊 ملخص الحضور والالتزام:\n• إجمالي الحصص المنفذة: {totalLessons} حصة\n• عدد مرات الحضور: {presentCount} ✅\n• مرات الغياب: {absentCount} ❌\n• اعتذارات مسبقة: {excusedCount} ⚠️\n• متوسط التقييم العام: {avgRating} من 5 ⭐\n\n{lessonsSummary}\n\n{notes}\n\nمع خالص تمنياتنا بالتفوق والنجاح الباهر دائماً 🌟`,
  lessonPrep: `السلام عليكم ورحمة الله وبركاته 🌷\n📋 بطاقة تحضير وخطة الحصة الدراسية\n\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n🎯 عنوان الدرس: {topic}\n{notes}\n\n1️⃣ الأهداف التعليمية:\n• استيعاب المفاهيم والمصطلحات الأساسية لدرس ({topic}).\n• التدرب على حل أمثلة ونماذج تطبيقية متنوعة.\n• التأكد من إتقان الطالب للمهارات المطلوبة قبل نهاية الحصة.\n\n2️⃣ خطة سير الحصة:\n• مراجعة سريعة لما تم في الحصة السابقة (5 إلى 10 دقائق).\n• الشرح التفاعلي المبسط وطرح الأمثلة (25 دقيقة).\n• حل تمارين تطبيقية وتقييم الفهم الفوري (15 دقيقة).\n\n3️⃣ الواجب والتكليفات المنزلية:\n• حل التمارين المحددة ومراجعة الملاحظات.\n\nمع خالص تمنياتنا بالتفوق والنجاح المستمر دائماً 🌟`
};

export function renderTemplate(templateText: string, vars: Record<string, any>): string {
  let result = templateText;
  Object.entries(vars).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val !== undefined && val !== null ? val : ''));
  });
  return result;
}
