export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type SubscriptionPlan = 'none' | 'monthly' | 'three_months' | 'six_months' | 'yearly' | 'custom';
export type ClassType = 'online' | 'in_person' | 'trial' | 'private' | 'center';
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type PaymentStatus = 'paid' | 'unpaid';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'once';

export type AbsenceReasonType =
  | 'excused_early'
  | 'unexcused_sudden'
  | 'emergency'
  | 'illness'
  | 'travel'
  | 'other';

export interface AbsencePolicySettings {
  excusedCountsFinancially: boolean;
  excusedHasMakeup: boolean;
  unexcusedCountsFinancially: boolean;
  unexcusedHasMakeup: boolean;
  autoAbsenceReminder?: boolean;
}

export const DEFAULT_ABSENCE_POLICY: AbsencePolicySettings = {
  excusedCountsFinancially: false,
  excusedHasMakeup: true,
  unexcusedCountsFinancially: true,
  unexcusedHasMakeup: false,
  autoAbsenceReminder: true,
};

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
  reminderMinutesBefore?: number;
  remindersEnabled?: boolean;
  teacherNotificationsEnabled?: boolean;
  timezone?: string;
  absencePolicy?: AbsencePolicySettings;
  whatsappTemplates?: {
    welcome?: string;
    payment?: string;
    report?: string;
    lessonPrep?: string;
    absenceReminder?: string;
  };
  focusModeEnabled?: boolean;
  onboardingCompleted?: boolean;
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

export type WorkplaceType = 'center' | 'private' | 'online';

export interface Workplace {
  id: string;
  teacherId: string;
  name: string;
  type: WorkplaceType;
  createdAt: any;
  updatedAt: any;
}

export interface EducationalCenter {
  id: string;
  ownerUid: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  archived?: boolean;
}

export interface GroupScheduleItem {
  day: number; // 0: الأحد ... 6: السبت
  time: string; // HH:MM
  duration?: number; // بالدقائق
}

export interface Group {
  id: string;
  ownerUid: string;
  teacherId?: string; // backward compat
  workplaceId?: string; // backward compat
  name: string;
  centerId: string;
  centerName: string;
  subject: string;
  grade?: string;
  schedule: GroupScheduleItem[];
  monthlyFee: number;
  color?: string;
  status: 'active' | 'paused';
  notes?: string;
  active?: boolean;
  archived?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface GroupMembership {
  id: string; // deterministic e.g. `${studentId}_${groupId}`
  ownerUid: string;
  studentId: string;
  studentName?: string;
  groupId: string | null; // null if individual
  groupName?: string;
  centerName?: string;
  joinedAt: any;
  leftAt?: any;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Student {
  id: string;
  teacherId: string;
  ownerUid?: string;
  name: string;
  phone?: string;
  parentPhone?: string;
  whatsapp?: string; // legacy support
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
  totalPrepaidLessons?: number; // إجمالي الحصص في باقة الحصص المدفوعة مسبقاً
  remainingPaidLessons?: number; // رصيد الحصص المدفوعة المتبقية
  learningStyle?: string;
  notes?: string;
  color?: string;
  groupId?: string; // legacy
  groupIds?: string[]; // multi-group support
  customFees?: Record<string, number>; // groupId -> amount
  active?: boolean;
  archived?: boolean;
  isIndividual?: boolean;
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
  isFinancialCounted?: boolean;
  is_financial_counted?: boolean;
  hasMakeupClass?: boolean;
  has_makeup_class?: boolean;
  makeupClassDate?: string | null;
  makeup_class_date?: string | null;
  absenceReasonType?: string;
  absence_reason_type?: string;
  makeupCompleted?: boolean;
  createdAt: any;
  updatedAt?: any;
  strengths?: string;
  challenges?: string;
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
  rating?: number; // تقييم الحصة بالساعات/النجوم (1-5)
  notes?: string; // ملاحظات وتقييم أداء الطالب في الحصة
  isMakeup?: boolean; // هل هي حصة تعويضية مجدولة
  originalLessonId?: string; // معرف الحصة الأصلية الغائبة
  createdAt: any;
  updatedAt: any;
}

export function isLessonFinanciallyCounted(l: LessonLog): boolean {
  if (l.is_financial_counted !== undefined) return Boolean(l.is_financial_counted);
  if (l.isFinancialCounted !== undefined) return Boolean(l.isFinancialCounted);
  if (l.attendance === 'absent' || l.attendance === 'excused') {
    if (l.cost === 0) return false;
  }
  return true;
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
  minutesBefore: number; // 5-120 minutes before class
  notifyTeacher: boolean;
  notifyParent: boolean;
  soundEnabled: boolean;
  autoOpenWhatsApp?: boolean;
  endOfDaySummaryEnabled?: boolean;
  endOfDaySummaryTime?: string; // e.g. "21:00"
  timezone?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES = {
  welcome: `السلام عليكم ورحمة الله وبركاته 🌷\nمرحباً بك معنا في رحلتنا التعليمية لمادة ({subject})! يسعدني جداً انضمام الطالب/ـة: {studentName} معنا.\nسنبذل قصارى جهدنا لتحقيق التفوق والتميز الدراسي إن شاء الله. 📚✨`,
  payment: `السلام عليكم ورحمة الله وبركاته 🌷\n🧾 كشف حساب ومطالبة مالية - مادة ({subject})\n\n👤 الطالب/ـة: {studentName}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n\n📊 تفاصيل المستحقات الحالية:\n• سعر الساعة: {hourlyRate} {currency}/ساعة\n• عدد الساعات المنفذة: {pendingHours} ساعة ({unsettledCount} حصص غير مصفاة)\n• إجمالي المستحقات المطلوبة: {pendingAmount} {currency} 💰\n\n{lessonsList}\n\nشاكرين ومقدرين لكم حسن التعاون والاهتمام الدائم 🌟`,
  report: `السلام عليكم ورحمة الله وبركاته 🌷\nتقرير المتابعة الشهري لشهر ({month})\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 المعلم: أ. {teacherName}\n\n📊 ملخص الحضور والالتزام:\n• إجمالي الحصص المنفذة: {totalLessons} حصة\n• عدد مرات الحضور: {presentCount} ✅\n• مرات الغياب: {absentCount} ❌\n• اعتذارات مسبقة: {excusedCount} ⚠️\n• متوسط التقييم العام: {avgRating} من 5 ⭐\n\n{lessonsSummary}\n\n{notes}\n\nمع خالص تمنياتنا بالتفوق والنجاح الباهر دائماً 🌟`,
  lessonPrep: `السلام عليكم ورحمة الله وبركاته 🌷\n📋 بطاقة تحضير وخطة الحصة الدراسية\n\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n🎯 عنوان الدرس: {topic}\n{notes}\n\n1️⃣ الأهداف التعليمية:\n• استيعاب المفاهيم والمصطلحات الأساسية لدرس ({topic}).\n• التدرب على حل أمثلة ونماذج تطبيقية متنوعة.\n• التأكد من إتقان الطالب للمهارات المطلوبة قبل نهاية الحصة.\n\n2️⃣ خطة سير الحصة:\n• مراجعة سريعة لما تم في الحصة السابقة (5 إلى 10 دقائق).\n• الشرح التفاعلي المبسط وطرح الأمثلة (25 دقيقة).\n• حل تمارين تطبيقية وتقييم الفهم الفوري (15 دقيقة).\n\n3️⃣ الواجب والتكليفات المنزلية:\n• حل التمارين المحددة ومراجعة الملاحظات.\n\nمع خالص تمنياتنا بالتفوق والنجاح المستمر دائماً 🌟`,
  absenceReminder: `السلام عليكم ورحمة الله وبركاته 🌷\nنود إحاطتكم علماً بخصوص حصة مادة ({subject}) للطالب/ـة: *{studentName}*:\n\n📅 موعد الحصة: {date}\n🎯 الحالة: {statusLabel}\n{financialNote}\n{makeupNote}\n{extraNotes}\nشاكرين ومقدرين حسن تعاونكم وحرصكم الدائم على مصلحة الطالب 🌟\nأ. {teacherName}`
};

export type NoteColor = 'amber' | 'emerald' | 'purple' | 'blue' | 'rose';

export interface QuickNote {
  id: string;
  teacherId: string;
  text: string;
  color?: NoteColor;
  isPinned?: boolean;
  isCompleted?: boolean;
  createdAt: any;
  updatedAt?: any;
}

export function renderTemplate(templateText: string, vars: Record<string, any>): string {
  let result = templateText;
  Object.entries(vars).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val !== undefined && val !== null ? val : ''));
  });
  return result;
}
