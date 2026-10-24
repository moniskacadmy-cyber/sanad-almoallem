export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type SubscriptionPlan = 'none' | 'monthly' | 'three_months' | 'six_months' | 'yearly' | 'custom';
export type ClassType = 'online' | 'in_person' | 'trial' | 'private' | 'center';
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'once';

export interface PaymentItem {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method?: string; // cash, instapay, etc.
  notes?: string;
}

export interface StudentPaymentRecord {
  id: string; // `${studentId}_${groupId || 'individual'}_${month}`
  teacherId?: string;
  studentId: string;
  studentName?: string;
  groupId: string; // groupId or 'individual'
  groupName?: string;
  month: string; // YYYY-MM
  status: PaymentStatus;
  amountPaid: number;
  amountDue: number;
  payments?: PaymentItem[];
  paidAt?: any;
  updatedAt?: any;
  notes?: string;
}

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
  absenceThreshold?: number; // عدد الحصص المسموح بها قبل التنبيه
  autoWarningEnabled?: boolean; // تفعيل رسائل الواتساب التلقائية
}

export const DEFAULT_ABSENCE_POLICY: AbsencePolicySettings = {
  excusedCountsFinancially: false,
  excusedHasMakeup: true,
  unexcusedCountsFinancially: true,
  unexcusedHasMakeup: false,
  autoAbsenceReminder: true,
};

export interface DailyGoal {
  id: string;
  text: string;
  completed: boolean;
}

export interface DoNotDisturbSettings {
  enabled: boolean;
  startTime: string; // e.g. "22:00"
  endTime: string;   // e.g. "07:00"
  muteWeekends?: boolean; // mute Friday & Saturday
  vacationMode?: boolean; // full pause for all alerts
}

export const DEFAULT_DND_SETTINGS: DoNotDisturbSettings = {
  enabled: false,
  startTime: '22:00',
  endTime: '07:00',
  muteWeekends: false,
  vacationMode: false,
};

export function isInDoNotDisturbPeriod(dnd?: DoNotDisturbSettings, checkDate: Date = new Date()): boolean {
  if (!dnd || !dnd.enabled) return false;
  if (dnd.vacationMode) return true;

  // Check weekend mute (5 = Friday, 6 = Saturday in standard JS Date)
  if (dnd.muteWeekends) {
    const day = checkDate.getDay();
    if (day === 5 || day === 6) return true;
  }

  if (!dnd.startTime || !dnd.endTime) return false;

  const currentMinutes = checkDate.getHours() * 60 + checkDate.getMinutes();
  const [startH, startM] = dnd.startTime.split(':').map(Number);
  const [endH, endM] = dnd.endTime.split(':').map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

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
  dailyGoals?: DailyGoal[];
  reminderMinutesBefore?: number;
  remindersEnabled?: boolean;
  teacherNotificationsEnabled?: boolean;
  timezone?: string;
  doNotDisturb?: DoNotDisturbSettings;
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
  notificationPreferences?: NotificationPreferences;
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
  billingType?: 'monthly' | 'hourly';
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
  dailyDigestEnabled?: boolean; // تذكير جدول حصص اليوم المجدول
  dailyDigestTime?: string;    // وقت التذكير الصباحي e.g. "08:00"
  timezone?: string;
}

export interface NotificationPreferences {
  // Event types
  newStudentRegistered: boolean; // تسجيل طالب جديد
  subscriptionNearExpiry: boolean; // قرب انتهاء الاشتراك
  classReminders: boolean; // تذكيرات مواعيد الحصص
  studentAbsenceRecorded: boolean; // تسجيل غياب أو اعتذار طالب
  paymentRecorded: boolean; // تسجيل دفعة مالية أو تصفية
  dailySummaryReport: boolean; // تقرير ملخص نهاية اليوم

  // Delivery channels
  browserPush: boolean; // إشعارات المتصفح والنظام
  inAppBanner: boolean; // أشرطة التنبيه داخل التطبيق
  soundChime: boolean; // نغمة التنبيه الصوتية
  whatsappAlerts: boolean; // تنبيهات واتساب
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newStudentRegistered: true,
  subscriptionNearExpiry: true,
  classReminders: true,
  studentAbsenceRecorded: true,
  paymentRecorded: true,
  dailySummaryReport: true,
  browserPush: true,
  inAppBanner: true,
  soundChime: true,
  whatsappAlerts: false,
};

export const DEFAULT_WHATSAPP_TEMPLATES = {
  welcome: `السلام عليكم ورحمة الله وبركاته 🌷\nمرحباً بك معنا في رحلتنا التعليمية لمادة ({subject})! يسعدني جداً انضمام الطالب/ـة: {studentName} معنا.\nسنبذل قصارى جهدنا لتحقيق التفوق والتميز الدراسي إن شاء الله. 📚✨`,
  payment: `السلام عليكم ورحمة الله وبركاته 🌷\n🧾 كشف حساب ومطالبة مالية - مادة ({subject})\n\n👤 الطالب/ـة: {studentName}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n\n📊 تفاصيل المستحقات الحالية:\n• سعر الساعة: {hourlyRate} {currency}/ساعة\n• عدد الساعات المنفذة: {pendingHours} ساعة ({unsettledCount} حصص غير مصفاة)\n• إجمالي المستحقات المطلوبة: {pendingAmount} {currency} 💰\n\n{lessonsList}\n\nشاكرين ومقدرين لكم حسن التعاون والاهتمام الدائم 🌟`,
  report: `السلام عليكم ورحمة الله وبركاته 🌷\nتقرير المتابعة الشهري لشهر ({month})\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 المعلم: أ. {teacherName}\n\n📊 ملخص الحضور والالتزام:\n• إجمالي الحصص المنفذة: {totalLessons} حصة\n• عدد مرات الحضور: {presentCount} ✅\n• مرات الغياب: {absentCount} ❌\n• اعتذارات مسبقة: {excusedCount} ⚠️\n• متوسط التقييم العام: {avgRating} من 5 ⭐\n\n{lessonsSummary}\n\n{notes}\n\nمع خالص تمنياتنا بالتفوق والنجاح الباهر دائماً 🌟`,
  lessonPrep: `السلام عليكم ورحمة الله وبركاته 🌷\n📋 بطاقة تحضير وخطة الحصة الدراسية\n\n👤 الطالب/ـة: {studentName}\n📚 المادة: {subject}\n👨‍🏫 إعداد المعلم: أ. {teacherName}\n📅 التاريخ: {date}\n🎯 عنوان الدرس: {topic}\n{notes}\n\n1️⃣ الأهداف التعليمية:\n• استيعاب المفاهيم والمصطلحات الأساسية لدرس ({topic}).\n• التدرب على حل أمثلة ونماذج تطبيقية متنوعة.\n• التأكد من إتقان الطالب للمهارات المطلوبة قبل نهاية الحصة.\n\n2️⃣ خطة سير الحصة:\n• مراجعة سريعة لما تم في الحصة السابقة (5 إلى 10 دقائق).\n• الشرح التفاعلي المبسط وطرح الأمثلة (25 دقيقة).\n• حل تمارين تطبيقية وتقييم الفهم الفوري (15 دقيقة).\n\n3️⃣ الواجب والتكليفات المنزلية:\n• حل التمارين المحددة ومراجعة الملاحظات.\n\nمع خالص تمنياتنا بالتفوق والنجاح المستمر دائماً 🌟`,
  absenceReminder: `السلام عليكم ورحمة الله وبركاته 🌷\nنود إحاطتكم علماً بخصوص حصة مادة ({subject}) للطالب/ـة: *{studentName}*:\n\n📅 موعد الحصة: {date}\n🎯 الحالة: {statusLabel}\n{financialNote}\n{makeupNote}\n{extraNotes}\nشاكرين ومقدرين حسن تعاونكم وحرصكم الدائم على مصلحة الطالب 🌟\nأ. {teacherName}`
};

export const ALL_SUBJECTS = [
  'القرآن الكريم',
  'اللغة العربية',
  'الرياضيات',
  'العلوم',
  'اللغة الإنجليزية',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التاريخ',
  'الجغرافيا',
  'الدراسات الاجتماعية',
  'اللغة الفرنسية',
  'اللغة الألمانية',
  'الحاسب الآلي والبرمجة',
  'أخرى',
];

export interface AttendanceRecord {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  subject: string;
  status: 'present' | 'absent' | 'late';
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: any;
  updatedAt?: any;
}

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

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'ج.م', name: 'جنيه مصري', symbol: 'EGP', flag: '🇪🇬' },
  { code: 'ر.س', name: 'ريال سعودي', symbol: 'SAR', flag: '🇸🇦' },
  { code: 'د.إ', name: 'درهم إماراتي', symbol: 'AED', flag: '🇦🇪' },
  { code: 'د.ك', name: 'دينار كويتي', symbol: 'KWD', flag: '🇰🇼' },
  { code: 'ر.ق', name: 'ريال قطري', symbol: 'QAR', flag: '🇶🇦' },
  { code: 'ر.ع', name: 'ريال عماني', symbol: 'OMR', flag: '🇴🇲' },
  { code: 'د.ب', name: 'دينار بحريني', symbol: 'BHD', flag: '🇧🇭' },
  { code: 'د.أ', name: 'دينار أردني', symbol: 'JOD', flag: '🇯🇴' },
  { code: 'د.ع', name: 'دينار عراقي', symbol: 'IQD', flag: '🇮🇶' },
  { code: 'ل.س', name: 'ليرة سورية', symbol: 'SYP', flag: '🇸🇾' },
  { code: 'ل.ل', name: 'ليرة لبنانية', symbol: 'LBP', flag: '🇱🇧' },
  { code: 'د.ت', name: 'دينار تونسي', symbol: 'TND', flag: '🇹🇳' },
  { code: 'د.ج', name: 'دينار جزائري', symbol: 'DZD', flag: '🇩🇿' },
  { code: 'د.م', name: 'درهم مغربي', symbol: 'MAD', flag: '🇲🇦' },
  { code: 'د.ل', name: 'دينار ليبي', symbol: 'LYD', flag: '🇱🇾' },
  { code: 'ج.س', name: 'جنيه سوداني', symbol: 'SDG', flag: '🇸🇩' },
  { code: '$', name: 'دولار أمريكي', symbol: 'USD', flag: '🇺🇸' },
  { code: '€', name: 'يورو', symbol: 'EUR', flag: '🇪🇺' },
  { code: '£', name: 'جنيه إسترليني', symbol: 'GBP', flag: '🇬🇧' },
  { code: 'TL', name: 'ليرة تركية', symbol: 'TRY', flag: '🇹🇷' },
];
