import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  TeacherProfile,
  Student,
  LessonLog,
  ScheduleSlot,
  LibraryItem,
  SubscriptionPlan
} from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test Firestore Connection as required by skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline. Please check your configuration.');
    }
  }
}
testConnection();

// Skill-mandated Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check if user is system admin
export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email === 'moniskacadmy@gmail.com') return true;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    return adminDoc.exists();
  } catch {
    return user.email === 'moniskacadmy@gmail.com';
  }
}

// Teacher Registration with 7-Day Trial and Server Timestamps
export async function registerTeacher(params: {
  name: string;
  email: string;
  whatsapp: string;
  subject: string;
  password?: string;
  existingUser?: User;
}): Promise<TeacherProfile> {
  let user = params.existingUser;
  if (!user && params.password) {
    const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
    user = credential.user;
  }
  if (!user) throw new Error('تعذر إتمام عملية التسجيل.');

  const teacherDocRef = doc(db, 'teachers', user.uid);
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const isAdminEmail = user.email === 'moniskacadmy@gmail.com';

  const newProfile = {
    id: user.uid,
    name: params.name.trim(),
    email: user.email || params.email.trim().toLowerCase(),
    whatsapp: params.whatsapp.trim(),
    subject: params.subject.trim(),
    role: isAdminEmail ? 'admin' : 'teacher',
    subscriptionStatus: 'trial',
    plan: 'none',
    trialStartDate: serverTimestamp(),
    trialEndDate: Timestamp.fromDate(trialEnd),
    subscriptionExpiresAt: Timestamp.fromDate(trialEnd),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(teacherDocRef, newProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `teachers/${user.uid}`);
  }

  // If bootstrap admin email, also record in admins collection
  if (isAdminEmail) {
    try {
      await setDoc(doc(db, 'admins', user.uid), {
        id: user.uid,
        email: user.email,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal if fails
    }
  }

  // Seed starter library templates
  try {
    await seedDefaultLibraryItems(user.uid);
  } catch (e) {
    console.error('Error seeding starter templates', e);
  }

  return {
    ...newProfile,
    trialStartDate: Timestamp.fromDate(now),
    trialEndDate: Timestamp.fromDate(trialEnd),
    subscriptionExpiresAt: Timestamp.fromDate(trialEnd),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  } as unknown as TeacherProfile;
}

// Google Sign-in helper
export async function signInWithGoogle(): Promise<{ user: User; isNew: boolean }> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const teacherDoc = await getDoc(doc(db, 'teachers', user.uid));
  return {
    user,
    isNew: !teacherDoc.exists(),
  };
}

// Teacher Profile Fetch / Realtime Listener
export function subscribeToTeacherProfile(
  teacherId: string,
  onUpdate: (profile: TeacherProfile | null) => void,
  onError?: (err: Error) => void
) {
  const path = `teachers/${teacherId}`;
  return onSnapshot(
    doc(db, 'teachers', teacherId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Compute dynamically if subscription has expired
        let status = data.subscriptionStatus;
        if (data.subscriptionExpiresAt) {
          const expiryDate = data.subscriptionExpiresAt.toDate();
          if (expiryDate < new Date()) {
            status = 'expired';
          }
        }
        onUpdate({
          ...data,
          id: snapshot.id,
          subscriptionStatus: status,
        } as TeacherProfile);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Update Teacher Self Profile
export async function updateTeacherProfile(teacherId: string, updates: {
  name?: string;
  whatsapp?: string;
  subject?: string;
}) {
  const path = `teachers/${teacherId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Admin Operations
export async function adminGetAllTeachers(): Promise<TeacherProfile[]> {
  const path = 'teachers';
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    return snap.docs.map((d) => {
      const data = d.data();
      let status = data.subscriptionStatus;
      if (data.subscriptionExpiresAt) {
        const expiryDate = data.subscriptionExpiresAt.toDate();
        if (expiryDate < new Date()) {
          status = 'expired';
        }
      }
      return {
        ...data,
        id: d.id,
        subscriptionStatus: status,
      } as TeacherProfile;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function adminActivateTeacher(
  teacherId: string,
  days: number,
  plan: SubscriptionPlan
) {
  const path = `teachers/${teacherId}`;
  try {
    const teacherDoc = await getDoc(doc(db, 'teachers', teacherId));
    let baseDate = new Date();
    if (teacherDoc.exists()) {
      const existing = teacherDoc.data();
      if (existing.subscriptionExpiresAt) {
        const exp = existing.subscriptionExpiresAt.toDate();
        if (exp > new Date()) {
          baseDate = exp;
        }
      }
    }
    const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    await updateDoc(doc(db, 'teachers', teacherId), {
      subscriptionStatus: 'active',
      plan,
      subscriptionExpiresAt: Timestamp.fromDate(newExpiresAt),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminResetTrial(teacherId: string) {
  const path = `teachers/${teacherId}`;
  try {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, 'teachers', teacherId), {
      subscriptionStatus: 'trial',
      plan: 'none',
      trialEndDate: Timestamp.fromDate(trialEnd),
      subscriptionExpiresAt: Timestamp.fromDate(trialEnd),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteTeacher(teacherId: string) {
  const path = `teachers/${teacherId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Student CRUD
export function subscribeToStudents(
  teacherId: string,
  onUpdate: (students: Student[]) => void
) {
  const path = `teachers/${teacherId}/students`;
  return onSnapshot(
    collection(db, 'teachers', teacherId, 'students'),
    (snap) => {
      const students = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as Student[];
      // sort by name in memory
      students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onUpdate(students);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addStudent(
  teacherId: string,
  student: Omit<Student, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
) {
  const path = `teachers/${teacherId}/students`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'students');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      ...student,
      id: newDoc.id,
      teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStudent(
  teacherId: string,
  studentId: string,
  updates: Partial<Student>
) {
  const path = `teachers/${teacherId}/students/${studentId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'students', studentId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudent(teacherId: string, studentId: string) {
  const path = `teachers/${teacherId}/students/${studentId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleStudentPaymentStatus(
  teacherId: string,
  studentId: string,
  currentStatus: 'paid' | 'unpaid'
) {
  const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
  const currentMonth = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date());
  return updateStudent(teacherId, studentId, {
    paymentStatus: newStatus,
    lastPaymentMonth: newStatus === 'paid' ? currentMonth : undefined,
  });
}

// Student Lessons Logs
export function subscribeToStudentLessons(
  teacherId: string,
  studentId: string,
  onUpdate: (lessons: LessonLog[]) => void
) {
  const path = `teachers/${teacherId}/students/${studentId}/lessons`;
  return onSnapshot(
    collection(db, 'teachers', teacherId, 'students', studentId, 'lessons'),
    (snap) => {
      const lessons = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as LessonLog[];
      lessons.sort((a, b) => b.date.localeCompare(a.date));
      onUpdate(lessons);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addLessonLog(
  teacherId: string,
  studentId: string,
  lesson: Omit<LessonLog, 'id' | 'teacherId' | 'studentId' | 'createdAt'>
) {
  const path = `teachers/${teacherId}/students/${studentId}/lessons`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'students', studentId, 'lessons');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      ...lesson,
      id: newDoc.id,
      studentId,
      teacherId,
      createdAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteLessonLog(teacherId: string, studentId: string, lessonId: string) {
  const path = `teachers/${teacherId}/students/${studentId}/lessons/${lessonId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'students', studentId, 'lessons', lessonId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Timetable / Schedules
export function subscribeToSchedules(
  teacherId: string,
  onUpdate: (schedules: ScheduleSlot[]) => void
) {
  const path = `teachers/${teacherId}/schedules`;
  return onSnapshot(
    collection(db, 'teachers', teacherId, 'schedules'),
    (snap) => {
      const items = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as ScheduleSlot[];
      items.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.time.localeCompare(b.time);
      });
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addSchedule(
  teacherId: string,
  schedule: Omit<ScheduleSlot, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
) {
  const path = `teachers/${teacherId}/schedules`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'schedules');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      ...schedule,
      id: newDoc.id,
      teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSchedule(
  teacherId: string,
  scheduleId: string,
  updates: Partial<ScheduleSlot>
) {
  const path = `teachers/${teacherId}/schedules/${scheduleId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'schedules', scheduleId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSchedule(teacherId: string, scheduleId: string) {
  const path = `teachers/${teacherId}/schedules/${scheduleId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'schedules', scheduleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Teacher Library
export function subscribeToLibrary(
  teacherId: string,
  onUpdate: (items: LibraryItem[]) => void
) {
  const path = `teachers/${teacherId}/library`;
  return onSnapshot(
    collection(db, 'teachers', teacherId, 'library'),
    (snap) => {
      const items = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as LibraryItem[];
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addLibraryItem(
  teacherId: string,
  item: Omit<LibraryItem, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
) {
  const path = `teachers/${teacherId}/library`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'library');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      ...item,
      id: newDoc.id,
      teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLibraryItem(
  teacherId: string,
  itemId: string,
  updates: Partial<LibraryItem>
) {
  const path = `teachers/${teacherId}/library/${itemId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'library', itemId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLibraryItem(teacherId: string, itemId: string) {
  const path = `teachers/${teacherId}/library/${itemId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'library', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Starter templates for teacher library
export async function seedDefaultLibraryItems(teacherId: string) {
  const templates: Omit<LibraryItem, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>[] = [
    {
      title: 'نموذج تحضير درس تفاعلي متكامل',
      type: 'lesson_plan',
      subject: 'عام لجميع المواد',
      content: `📌 عنوان الدرس: [اكتب عنوان الدرس هنا]
🎯 الأهداف التعليمية:
1. أن يتعرف الطالب على المفاهيم الأساسية لـ [...]
2. أن يتمكن الطالب من حل التطبيقات والمسائل الخاصة بـ [...]
3. أن يربط الطالب المفاهيم بحياتنا اليومية.

⏱️ التمهيد (5 دقائق):
- سؤال تحفيزي ومراجعة سريعة لما تم شرحه في الحصة السابقة.

📚 خطة الشرح والتطبيق (35 دقيقة):
- شرح الفكرة الأولى بالأمثلة التوضيحية.
- حل مسألة مشتركة مع الطالب خطوة بخطوة.
- تدريب فردي: يحل الطالب تمريناً بمفرده مع التوجيه الفوري.

💡 التقويم الختامي (10 دقائق):
- سؤال قياس استيعاب سريع + تلخيص النقاط الجوهرية.

📝 الواجب المنزلي:
- حل تدريبات صفحة [...] من كراسة التمارين.`,
    },
    {
      title: 'قالب اختبار قصير أسبوعي (Quiz - 5 أسئلة)',
      type: 'quiz',
      subject: 'عام لجميع المواد',
      content: `📝 اختبار قصير - مادة: [...]
👤 اسم الطالب: ...........................  📅 التاريخ: ... / ... / 202...

السؤال الأول (اختيار من متعدد) [درجتان]:
• ..............................................................
  [ أ ] ..........    [ ب ] ..........    [ ج ] ..........    [ د ] ..........

السؤال الثاني (صواب أو خطأ مع التعليل) [درجتان]:
• (   ) ........................................................
التعليل: .......................................................

السؤال الثالث (مسألة تطبيقية) [3 درجات]:
• احسب / وضح بالخطوات: .......................................
الحل:

السؤال الرابع (سؤال مهارات تفكير) [3 درجات]:
• ماذا تتوقع أن يحدث لو .....................................؟

💯 الدرجة الكلية: ( 10 / 10 )
⭐ تقييم المعلم وملاحظاته: ....................................`,
    },
    {
      title: 'تقرير متابعة أسبوعي/شهري لولي الأمر (جاهز للواتساب)',
      type: 'summary',
      subject: 'متابعة أولياء الأمور',
      content: `السلام عليكم ورحمة الله وبركاته 🌷
تحية طيبة لولي أمر الطالب/ـة المتميز/ة: [اسم الطالب]

يسعدنا إحاطتكم بتقرير متابعة حصص مادة [المادة] خلال الفترة الماضية:

✨ نسبة الحضور والالتزام: [100% / ممتاز]
📖 ما تم إنجازه وشرحه: [تفاصيل الدروس المنجزة]
📝 حل الواجبات المنزلية: [ممتاز - مكتمل بانتظام]
🎯 نتيجة الاختبار القصير: [درجة الطالب من 10]
💡 ملاحظات المعلم وتوصياته:
- الطالب يبدي تفاعلاً رائعاً وحرصاً على الاستفادة.
- ننصح بالتركيز المستمر على حل التمارين الإضافية.

مع خالص تمنياتنا بالتفوق والنجاح الدائم 🌟
معلمكم: [اسم المعلم]`,
    },
  ];

  for (const t of templates) {
    await addLibraryItem(teacherId, t);
  }
}
