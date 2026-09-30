export type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type SubscriptionPlan = 'none' | 'monthly' | 'three_months' | 'six_months' | 'yearly' | 'custom';
export type ClassType = 'online' | 'center' | 'private';
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
  monthlyFee: number;
  paymentStatus: PaymentStatus;
  lastPaymentMonth?: string;
  learningStyle?: string;
  notes?: string;
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
  createdAt: any;
  updatedAt: any;
}

export interface LibraryItem {
  id: string;
  teacherId: string;
  title: string;
  type: 'lesson_plan' | 'quiz' | 'summary';
  subject?: string;
  content: string;
  createdAt: any;
  updatedAt: any;
}

export interface AdminStats {
  totalTeachers: number;
  activeSubscribers: number;
  inTrial: number;
  expired: number;
}
