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
  morningSummaryEnabled?: boolean;
  morningSummaryTime?: string; // "HH:MM" in the teacher's time zone
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
  monthly