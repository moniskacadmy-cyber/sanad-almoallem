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
  onSnapshot,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import rawFirebaseConfig from '../firebase-applet-config.json';
import {
  TeacherProfile,
  Student,
  LessonLog,
  ScheduleSlot,
  LibraryItem,
  SubscriptionPlan,
  SubscriptionStatus,
  BackupData,
  QuickNote,
  NoteColor,
} from './types';

// Read Firebase configuration from environment variables with fallback to config file
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || rawFirebaseConfig.apiKey,
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || rawFirebaseConfig.authDomain,
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || rawFirebaseConfig.projectId,
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || rawFirebaseConfig.storageBucket,
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || rawFirebaseConfig.messagingSenderId,
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || rawFirebaseConfig.appId,
};

const envDatabaseId =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID
    ? import.meta.env.VITE_FIREBASE_DATABASE_ID.trim()
    : undefined;

const effectiveDatabaseId =
  envDatabaseId !== undefined && envDatabaseId !== ''
    ? envDatabaseId
    : (rawFirebaseConfig as any).firestoreDatabaseId || 'ai-studio-f9d7667a-6157-4def-8ccd-a9acd863d453';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db =
  effectiveDatabaseId === '(default)' || !effectiveDatabaseId
    ? getFirestore(app)
    : getFirestore(app, effectiveDatabaseId);

// Enable Firestore Local IndexedDB Offline Persistence & Automatic Cloud Synchronization
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      enableIndexedDbPersistence(db).catch((e) => {
        console.warn('Firestore offline persistence fallback warning:', e);
      });
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline persistence is not supported in this browser.');
    }
  });
}

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

// Check if user is system admin based purely on uid existence in admins collection
export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    return adminDoc.exists();
  } catch {
    return false;
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

  let isUserAdmin = false;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    isUserAdmin = adminDoc.exists();
  } catch {
    isUserAdmin = false;
  }
  const normalizedEmail = (user.email || params.email).trim().toLowerCase();

  // Check if admin pre-provisioned a subscription for this email
  let initialStatus: SubscriptionStatus = 'trial';
  let initialPlan: SubscriptionPlan = 'none';
  let initialEndDate = trialEnd;
  let isActive = true;

  try {
    const subDoc = await getDoc(doc(db, 'subscriptions', normalizedEmail));
    if (subDoc.exists()) {
      const subData = subDoc.data();
      if (subData.subscriptionEndDate) {
        const subDate = subData.subscriptionEndDate.toDate ? subData.subscriptionEndDate.toDate() : new Date(subData.subscriptionEndDate);
        if (subDate > new Date() && subData.isActive !== false) {
          initialStatus = 'active';
          initialPlan = (subData.plan as SubscriptionPlan) || 'monthly';
          initialEndDate = subDate;
        }
      }
      if (subData.isActive === false) {
        isActive = false;
        initialStatus = 'expired';
      }
    }
  } catch (e) {
    console.warn('Subscription pre-check note:', e);
  }

  const newProfile = {
    id: user.uid,
    name: params.name.trim(),
    email: normalizedEmail,
    whatsapp: params.whatsapp.trim(),
    subject: params.subject.trim(),
    role: isUserAdmin ? 'admin' : 'teacher',
    subscriptionStatus: initialStatus,
    plan: initialPlan,
    isActive: isActive,
    subscriptionEndDate: Timestamp.fromDate(initialEndDate),
    trialStartDate: serverTimestamp(),
    trialEndDate: Timestamp.fromDate(trialEnd),
    subscriptionExpiresAt: Timestamp.fromDate(initialEndDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(teacherDocRef, newProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `teachers/${user.uid}`);
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
        // Compute dynamically if subscription has expired or is deactivated
        let status = data.subscriptionStatus;
        const isDeactivated = data.isActive === false;

        const effectiveExpiry = data.subscriptionEndDate || data.subscriptionExpiresAt;
        if (effectiveExpiry) {
          const expiryDate = effectiveExpiry.toDate ? effectiveExpiry.toDate() : new Date(effectiveExpiry);
          if (expiryDate < new Date() || isDeactivated) {
            status = 'expired';
          }
        } else if (isDeactivated) {
          status = 'expired';
        }

        onUpdate({
          ...data,
          id: snapshot.id,
          isActive: data.isActive !== false,
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
  currency?: string;
  whatsappTemplates?: {
    welcome?: string;
    payment?: string;
    report?: string;
    lessonPrep?: string;
  };
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
    const teachersList = snap.docs.map((d) => {
      const data = d.data();
      let status = data.subscriptionStatus;
      const isDeactivated = data.isActive === false;
      const effectiveExpiry = data.subscriptionEndDate || data.subscriptionExpiresAt;
      if (effectiveExpiry) {
        const expiryDate = effectiveExpiry.toDate ? effectiveExpiry.toDate() : new Date(effectiveExpiry);
        if (expiryDate < new Date() || isDeactivated) {
          status = 'expired';
        }
      } else if (isDeactivated) {
        status = 'expired';
      }

      return {
        ...data,
        id: d.id,
        isActive: data.isActive !== false,
        subscriptionStatus: status,
      } as TeacherProfile;
    });

    // Also fetch pre-provisioned subscriptions that don't yet have teacher accounts
    try {
      const subSnap = await getDocs(collection(db, 'subscriptions'));
      const existingEmails = new Set(teachersList.map((t) => t.email.toLowerCase()));

      subSnap.docs.forEach((sDoc) => {
        const sData = sDoc.data();
        const subEmail = (sData.email || sDoc.id).toLowerCase();
        if (!existingEmails.has(subEmail)) {
          const effectiveExpiry = sData.subscriptionEndDate;
          let isExpired = false;
          if (effectiveExpiry) {
            const exp = effectiveExpiry.toDate ? effectiveExpiry.toDate() : new Date(effectiveExpiry);
            if (exp < new Date()) isExpired = true;
          }
          if (sData.isActive === false) isExpired = true;

          teachersList.push({
            id: `sub_${sDoc.id}`,
            name: sData.name || 'معلم جديد (في انتظار التسجيل)',
            email: subEmail,
            whatsapp: sData.whatsapp || 'غير محدد بعد',
            subject: sData.subject || 'غير محدد بعد',
            role: 'teacher',
            subscriptionStatus: isExpired ? 'expired' : 'active',
            plan: sData.plan || 'monthly',
            isActive: sData.isActive !== false,
            subscriptionEndDate: sData.subscriptionEndDate,
            subscriptionExpiresAt: sData.subscriptionEndDate,
            trialStartDate: null,
            trialEndDate: null,
            createdAt: sData.updatedAt || Timestamp.now(),
            updatedAt: sData.updatedAt || Timestamp.now(),
          } as TeacherProfile);
        }
      });
    } catch (e) {
      console.warn('Subscriptions list note:', e);
    }

    return teachersList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Add or Activate Subscription for teacher by email
export async function adminSaveSubscription(params: {
  email: string;
  name?: string;
  durationType: 'trial' | 'monthly' | 'three_months' | 'six_months' | 'yearly' | 'custom';
  customEndDate?: string; // YYYY-MM-DD
  isActive?: boolean;
}): Promise<{ success: boolean; message: string; teacherFound: boolean }> {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح');
  }

  let newExpiryDate: Date;
  let planName: SubscriptionPlan = 'monthly';

  if (params.durationType === 'trial') {
    newExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    planName = 'none';
  } else if (params.durationType === 'monthly') {
    newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    planName = 'monthly';
  } else if (params.durationType === 'three_months') {
    newExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    planName = 'three_months';
  } else if (params.durationType === 'six_months') {
    newExpiryDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    planName = 'six_months';
  } else if (params.durationType === 'yearly') {
    newExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    planName = 'yearly';
  } else if (params.durationType === 'custom' && params.customEndDate) {
    newExpiryDate = new Date(params.customEndDate);
    newExpiryDate.setHours(23, 59, 59, 999);
    planName = 'custom';
  } else {
    newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  const isActive = params.isActive !== false;
  const status: SubscriptionStatus = isActive && newExpiryDate > new Date() ? 'active' : 'expired';

  // 1. Save/Update in subscriptions collection
  try {
    await setDoc(
      doc(db, 'subscriptions', normalizedEmail),
      {
        email: normalizedEmail,
        name: params.name?.trim() || '',
        isActive,
        plan: planName,
        subscriptionEndDate: Timestamp.fromDate(newExpiryDate),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving to subscriptions collection:', err);
  }

  // 2. Find if teacher with this email already exists in teachers collection
  let teacherFound = false;
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    for (const tDoc of snap.docs) {
      const tData = tDoc.data();
      if (tData.email && tData.email.trim().toLowerCase() === normalizedEmail) {
        teacherFound = true;
        await updateDoc(doc(db, 'teachers', tDoc.id), {
          isActive,
          subscriptionStatus: status,
          plan: planName,
          subscriptionEndDate: Timestamp.fromDate(newExpiryDate),
          subscriptionExpiresAt: Timestamp.fromDate(newExpiryDate),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'teachers');
  }

  return {
    success: true,
    teacherFound,
    message: teacherFound
      ? 'تم تفعيل وتحديث اشتراك المعلم بنجاح!'
      : 'تم حفظ وتفعيل الاشتراك مسبقاً لهذا البريد. سيتم تفعيله فور تسجيل المعلم!',
  };
}

// Toggle teacher active / inactive (deactivate / unban)
export async function adminToggleTeacherActive(
  teacherId: string,
  email: string,
  isActive: boolean
) {
  const normalizedEmail = email.trim().toLowerCase();
  const isPreSubOnly = teacherId.startsWith('sub_');

  if (!isPreSubOnly) {
    const path = `teachers/${teacherId}`;
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        isActive,
        subscriptionStatus: isActive ? 'active' : 'expired',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  try {
    await setDoc(
      doc(db, 'subscriptions', normalizedEmail),
      {
        email: normalizedEmail,
        isActive,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Subscription sync error:', err);
  }
}

// Extend or Set subscription date for teacher
export async function adminActivateTeacher(
  teacherId: string,
  days: number,
  plan: SubscriptionPlan
) {
  const isPreSubOnly = teacherId.startsWith('sub_');
  const path = `teachers/${teacherId}`;

  let baseDate = new Date();
  let teacherEmail = '';

  if (!isPreSubOnly) {
    try {
      const teacherDoc = await getDoc(doc(db, 'teachers', teacherId));
      if (teacherDoc.exists()) {
        const existing = teacherDoc.data();
        teacherEmail = existing.email || '';
        const effectiveExpiry = existing.subscriptionEndDate || existing.subscriptionExpiresAt;
        if (effectiveExpiry) {
          const exp = effectiveExpiry.toDate ? effectiveExpiry.toDate() : new Date(effectiveExpiry);
          if (exp > new Date()) {
            baseDate = exp;
          }
        }
      }
    } catch (err) {
      console.warn('Error reading teacher doc:', err);
    }
  } else {
    teacherEmail = teacherId.replace('sub_', '');
  }

  const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  if (!isPreSubOnly) {
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        isActive: true,
        subscriptionStatus: 'active',
        plan,
        subscriptionEndDate: Timestamp.fromDate(newExpiresAt),
        subscriptionExpiresAt: Timestamp.fromDate(newExpiresAt),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  if (teacherEmail) {
    try {
      await setDoc(
        doc(db, 'subscriptions', teacherEmail.toLowerCase()),
        {
          email: teacherEmail.toLowerCase(),
          isActive: true,
          plan,
          subscriptionEndDate: Timestamp.fromDate(newExpiresAt),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Subscription update error:', e);
    }
  }
}

// Set custom end date for teacher
export async function adminSetCustomExpiry(
  teacherId: string,
  email: string,
  dateString: string,
  plan: SubscriptionPlan = 'custom'
) {
  const newDate = new Date(dateString);
  newDate.setHours(23, 59, 59, 999);
  const normalizedEmail = email.trim().toLowerCase();
  const isActive = newDate > new Date();
  const isPreSubOnly = teacherId.startsWith('sub_');

  if (!isPreSubOnly) {
    const path = `teachers/${teacherId}`;
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        isActive,
        subscriptionStatus: isActive ? 'active' : 'expired',
        plan,
        subscriptionEndDate: Timestamp.fromDate(newDate),
        subscriptionExpiresAt: Timestamp.fromDate(newDate),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  try {
    await setDoc(
      doc(db, 'subscriptions', normalizedEmail),
      {
        email: normalizedEmail,
        isActive,
        plan,
        subscriptionEndDate: Timestamp.fromDate(newDate),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Subscription sync error:', e);
  }
}

export async function adminResetTrial(teacherId: string) {
  const isPreSubOnly = teacherId.startsWith('sub_');
  if (isPreSubOnly) return;

  const path = `teachers/${teacherId}`;
  try {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, 'teachers', teacherId), {
      isActive: true,
      subscriptionStatus: 'trial',
      plan: 'none',
      trialEndDate: Timestamp.fromDate(trialEnd),
      subscriptionEndDate: Timestamp.fromDate(trialEnd),
      subscriptionExpiresAt: Timestamp.fromDate(trialEnd),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteTeacher(teacherId: string) {
  const isPreSubOnly = teacherId.startsWith('sub_');
  if (isPreSubOnly) {
    const email = teacherId.replace('sub_', '');
    try {
      await deleteDoc(doc(db, 'subscriptions', email));
    } catch (e) {
      console.warn('Delete sub error:', e);
    }
    return;
  }

  const path = `teachers/${teacherId}`;
  try {
    const teacherDoc = await getDoc(doc(db, 'teachers', teacherId));
    if (teacherDoc.exists()) {
      const email = teacherDoc.data()?.email;
      if (email) {
        try {
          await deleteDoc(doc(db, 'subscriptions', email.toLowerCase()));
        } catch {}
      }
    }
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
    // 1. Cascade Delete: Delete all lesson logs from subcollection
    try {
      const lessonsSnap = await getDocs(
        collection(db, 'teachers', teacherId, 'students', studentId, 'lessons')
      );
      const deleteLessonPromises = lessonsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteLessonPromises);
    } catch (e) {
      console.warn('Could not fetch/delete student lessons:', e);
    }

    // 2. Cascade Delete: Delete any reports subcollection
    try {
      const reportsSnap = await getDocs(
        collection(db, 'teachers', teacherId, 'students', studentId, 'reports')
      );
      const deleteReportPromises = reportsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteReportPromises);
    } catch (e) {
      console.warn('Could not fetch/delete student reports:', e);
    }

    // 3. Cascade Delete: Delete all schedule slots associated with this student
    try {
      const schedulesSnap = await getDocs(collection(db, 'teachers', teacherId, 'schedules'));
      const studentSchedules = schedulesSnap.docs.filter((d) => {
        const data = d.data();
        return data.studentId === studentId;
      });
      const deleteSchedulePromises = studentSchedules.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteSchedulePromises);
    } catch (e) {
      console.warn('Could not fetch/delete student schedules:', e);
    }

    // 4. Cascade Delete: Delete main student document
    await deleteDoc(doc(db, 'teachers', teacherId, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
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
    const duration = lesson.duration || 60;
    const hourlyRate = lesson.hourlyRate || 100;
    const computedCost = lesson.cost !== undefined ? lesson.cost : Math.round((duration / 60) * hourlyRate);

    await setDoc(newDoc, {
      ...lesson,
      duration,
      hourlyRate,
      cost: computedCost,
      settled: lesson.settled !== undefined ? lesson.settled : false,
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

export async function settleStudentAccount(teacherId: string, studentId: string) {
  const path = `teachers/${teacherId}/students/${studentId}`;
  try {
    const snap = await getDocs(collection(db, 'teachers', teacherId, 'students', studentId, 'lessons'));
    const updates = snap.docs
      .filter((d) => !d.data().settled)
      .map((d) =>
        updateDoc(doc(db, 'teachers', teacherId, 'students', studentId, 'lessons', d.id), {
          settled: true,
          settledAt: serverTimestamp(),
        })
      );
    await Promise.all(updates);

    await updateDoc(doc(db, 'teachers', teacherId, 'students', studentId), {
      paymentStatus: 'paid',
      lastSettledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleScheduleCompletedToday(
  teacherId: string,
  scheduleId: string,
  isCompleted: boolean
) {
  const path = `teachers/${teacherId}/schedules/${scheduleId}`;
  try {
    const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
    await updateDoc(doc(db, 'teachers', teacherId, 'schedules', scheduleId), {
      completedTodayDate: isCompleted ? todayStr : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

export async function saveScheduleEvaluation(
  teacherId: string,
  scheduleId: string,
  rating: number,
  notes?: string
) {
  const path = `teachers/${teacherId}/schedules/${scheduleId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'schedules', scheduleId), {
      rating,
      notes: notes ? notes.trim() : '',
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

// Backup & Data Export / Import Operations
export async function fetchAllStudentLessons(
  teacherId: string,
  students: Student[]
): Promise<Record<string, LessonLog[]>> {
  const allLessons: Record<string, LessonLog[]> = {};
  for (const student of students) {
    const path = `teachers/${teacherId}/students/${student.id}/lessons`;
    try {
      const snap = await getDocs(
        collection(db, 'teachers', teacherId, 'students', student.id, 'lessons')
      );
      allLessons[student.id] = snap.docs.map((d) => ({
        ...(d.data() as LessonLog),
        id: d.id,
      }));
    } catch (err) {
      console.warn(`Could not fetch lessons for student ${student.id}:`, err);
      allLessons[student.id] = [];
    }
  }
  return allLessons;
}

export async function importFullTeacherBackup(
  teacherId: string,
  backup: BackupData
): Promise<{
  studentsCount: number;
  schedulesCount: number;
  lessonsCount: number;
  libraryCount: number;
}> {
  let studentsCount = 0;
  let schedulesCount = 0;
  let lessonsCount = 0;
  let libraryCount = 0;

  // 1. Import Students
  if (Array.isArray(backup.students)) {
    for (const st of backup.students) {
      const path = `teachers/${teacherId}/students/${st.id}`;
      try {
        const studentDocRef = doc(db, 'teachers', teacherId, 'students', st.id);
        await setDoc(
          studentDocRef,
          {
            name: st.name || '',
            whatsapp: st.whatsapp || '',
            subject: st.subject || '',
            classType: st.classType || 'private',
            monthlyFee: Number(st.monthlyFee) || 0,
            paymentStatus: st.paymentStatus || 'unpaid',
            lastPaymentMonth: st.lastPaymentMonth || '',
            learningStyle: st.learningStyle || '',
            notes: st.notes || '',
            color: st.color || 'purple',
            id: st.id,
            teacherId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        studentsCount++;
      } catch (err) {
        console.error('Error importing student:', err);
      }
    }
  }

  // 2. Import Schedules
  if (Array.isArray(backup.schedules)) {
    for (const sc of backup.schedules) {
      const path = `teachers/${teacherId}/schedules/${sc.id}`;
      try {
        const schedDocRef = doc(db, 'teachers', teacherId, 'schedules', sc.id);
        await setDoc(
          schedDocRef,
          {
            studentId: sc.studentId || '',
            studentName: sc.studentName || '',
            dayOfWeek: Number(sc.dayOfWeek) || 0,
            time: sc.time || '16:00',
            duration: Number(sc.duration) || 60,
            recurrence: sc.recurrence || 'weekly',
            classType: sc.classType || 'private',
            color: sc.color || 'purple',
            locationOrLink: sc.locationOrLink || '',
            id: sc.id,
            teacherId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        schedulesCount++;
      } catch (err) {
        console.error('Error importing schedule:', err);
      }
    }
  }

  // 3. Import Lessons
  if (backup.lessons && typeof backup.lessons === 'object') {
    for (const [studentId, logs] of Object.entries(backup.lessons)) {
      if (Array.isArray(logs)) {
        for (const log of logs) {
          const path = `teachers/${teacherId}/students/${studentId}/lessons/${log.id}`;
          try {
            const lessonDocRef = doc(
              db,
              'teachers',
              teacherId,
              'students',
              studentId,
              'lessons',
              log.id
            );
            await setDoc(
              lessonDocRef,
              {
                date: log.date || new Date().toISOString().slice(0, 10),
                topic: log.topic || '',
                homework: log.homework || '',
                attendance: log.attendance || 'present',
                rating: Number(log.rating) || 5,
                notes: log.notes || '',
                id: log.id,
                studentId,
                teacherId,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
            lessonsCount++;
          } catch (err) {
            console.error('Error importing lesson log:', err);
          }
        }
      }
    }
  }

  // 4. Import Library Items
  if (Array.isArray(backup.libraryItems)) {
    for (const item of backup.libraryItems) {
      const path = `teachers/${teacherId}/library/${item.id}`;
      try {
        const libDocRef = doc(db, 'teachers', teacherId, 'library', item.id);
        await setDoc(
          libDocRef,
          {
            title: item.title || '',
            type: item.type || 'summary',
            subject: item.subject || '',
            content: item.content || '',
            fileName: item.fileName || '',
            fileSize: item.fileSize || '',
            fileData: item.fileData || '',
            id: item.id,
            teacherId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        libraryCount++;
      } catch (err) {
        console.error('Error importing library item:', err);
      }
    }
  }

  return {
    studentsCount,
    schedulesCount,
    lessonsCount,
    libraryCount,
  };
}

export async function runOrphanCleanup(_teacherId: string, _activeStudentIds: string[]): Promise<void> {
  console.log('[OrphanCleanup] Skipped: orphan cleanup is disabled / no-op.');
  return;
}

// Quick Notes CRUD
export function subscribeToQuickNotes(
  teacherId: string,
  onUpdate: (notes: QuickNote[]) => void
) {
  const path = `teachers/${teacherId}/notes`;
  return onSnapshot(
    collection(db, 'teachers', teacherId, 'notes'),
    (snap) => {
      const notes = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as QuickNote[];

      // Sort: pinned first, then by createdAt desc
      notes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      onUpdate(notes);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addQuickNote(
  teacherId: string,
  note: { text: string; color?: NoteColor; isPinned?: boolean }
) {
  const path = `teachers/${teacherId}/notes`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'notes');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      id: newDoc.id,
      teacherId,
      text: note.text.trim(),
      color: note.color || 'amber',
      isPinned: !!note.isPinned,
      isCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateQuickNote(
  teacherId: string,
  noteId: string,
  updates: Partial<QuickNote>
) {
  const path = `teachers/${teacherId}/notes/${noteId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'notes', noteId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQuickNote(teacherId: string, noteId: string) {
  const path = `teachers/${teacherId}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function togglePinQuickNote(teacherId: string, noteId: string, currentPinned: boolean) {
  return updateQuickNote(teacherId, noteId, { isPinned: !currentPinned });
}

export async function toggleCompleteQuickNote(teacherId: string, noteId: string, currentCompleted: boolean) {
  return updateQuickNote(teacherId, noteId, { isCompleted: !currentCompleted });
}

import { getMessaging, getToken, isSupported } from 'firebase/messaging';

// Function to request permission and save FCM token for web push notifications
export async function requestAndSaveFCMToken(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const isMessagingSupported = await isSupported();
    if (!isMessagingSupported) {
      return {
        success: false,
        error: 'المتصفح الحالي لا يدعم إشعارات الويب المباشرة (Web Push Notifications).',
      };
    }

    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        success: false,
        error: 'تم رفض إذن الإشعارات من المتصفح. يرجى السماح بالإشعارات من إعدادات المتصفح وإعادة المحاولة.',
      };
    }
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'لم يتم منح إذن الإشعارات.',
      };
    }

    const messaging = getMessaging(app);
    let swReg: ServiceWorkerRegistration | undefined = undefined;

    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swErr) {
        console.warn('Could not register firebase-messaging-sw.js directly:', swErr);
      }
    }

    const vapidKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) || undefined;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      return {
        success: false,
        error: 'تعذر الحصول على رمز الإشعارات (FCM Token). يرجى التأكد من إضافة مفتاح VAPID.',
      };
    }

    const user = auth.currentUser;
    if (user) {
      // 1. Save in users/{uid}/fcmTokens/{tokenId}
      const userTokenRef = doc(db, 'users', user.uid, 'fcmTokens', token);
      await setDoc(
        userTokenRef,
        {
          token,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userAgent: navigator.userAgent,
        },
        { merge: true }
      );

      // 2. Save in teachers/{uid}/fcmTokens/{tokenId}
      const teacherTokenRef = doc(db, 'teachers', user.uid, 'fcmTokens', token);
      await setDoc(
        teacherTokenRef,
        {
          token,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userAgent: navigator.userAgent,
        },
        { merge: true }
      );
    }

    return { success: true, token };
  } catch (err: any) {
    console.error('Error enabling phone notifications / FCM:', err);
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء تفعيل إشعارات الهاتف.',
    };
  }
}



