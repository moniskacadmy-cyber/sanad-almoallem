import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User,
  Auth
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
  Firestore
} from 'firebase/firestore';
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
  Workplace,
  Group,
  WorkplaceType,
  EducationalCenter,
  GroupMembership,
  GroupScheduleItem,
  AttendanceRecord,
  PaymentStatus,
  StudentPaymentRecord,
} from './types';

import rawFirebaseConfig from '../firebase-applet-config.json';

const env = import.meta.env;

const pick = (envValue: unknown, fileValue: unknown): string =>
  (typeof envValue === 'string' && envValue.trim()) ||
  (typeof fileValue === 'string' && fileValue.trim()) ||
  '';

const firebaseConfig = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY, rawFirebaseConfig.apiKey),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN, rawFirebaseConfig.authDomain),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID, rawFirebaseConfig.projectId),
  storageBucket: pick(env.VITE_FIREBASE_STORAGE_BUCKET, rawFirebaseConfig.storageBucket),
  messagingSenderId: pick(env.VITE_FIREBASE_MESSAGING_SENDER_ID, rawFirebaseConfig.messagingSenderId),
  appId: pick(env.VITE_FIREBASE_APP_ID, rawFirebaseConfig.appId),
};

const effectiveDatabaseId =
  pick(env.VITE_FIREBASE_DATABASE_ID, (rawFirebaseConfig as any).firestoreDatabaseId) || '(default)';

export let app: FirebaseApp = null as any;
export let auth: Auth = null as any;
export let db: Firestore = null as any;
export let firebaseInitError: Error | null = null;

try {
  const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`إعدادات Firebase ناقصة: ${missing.join(', ')}. ضيفها في VITE_FIREBASE_* على Vercel وأعد النشر.`);
  }

  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalAutoDetectLongPolling: true,
    },
    effectiveDatabaseId === '(default)' || !effectiveDatabaseId ? undefined : effectiveDatabaseId
  );
} catch (err: any) {
  console.error('Firebase initialization error caught safely:', err);
  firebaseInitError = err instanceof Error ? err : new Error(String(err));
}

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

  const isEmailVerified = Boolean(user.emailVerified || (user.providerData && user.providerData.some(p => p.providerId === 'google.com')));

  // Check if admin pre-provisioned a subscription for this email
  let initialStatus: SubscriptionStatus = 'trial';
  let initialPlan: SubscriptionPlan = 'none';
  let initialEndDate = trialEnd;
  let isActive = true;

  if (isEmailVerified) {
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

  try {
    await setDoc(doc(collection(db, 'admin_notifications')), {
      type: 'new_user_registration',
      teacherId: user.uid,
      teacherName: params.name.trim(),
      teacherEmail: normalizedEmail,
      whatsapp: params.whatsapp.trim(),
      subject: params.subject.trim(),
      createdAt: serverTimestamp(),
      read: false,
    });
  } catch (err) {
    console.warn('Could not record admin notification:', err);
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
  provider.setCustomParameters({ prompt: 'select_account' });

  let result;
  try {
    result = await signInWithPopup(auth, provider);
  } catch (error: any) {
    const code = typeof error?.code === 'string' ? error.code : '';
    const msg = typeof error?.message === 'string' ? error.message : '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      msg.includes('Cross-Origin-Opener-Policy')
    ) {
      await signInWithRedirect(auth, provider);
      // signInWithRedirect navigates away, but TypeScript needs a return
      throw new Error('redirecting');
    }
    throw error;
  }

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
  remindersEnabled?: boolean;
  reminderMinutesBefore?: number;
  teacherNotificationsEnabled?: boolean;
  timezone?: string;
  whatsappTemplates?: {
    welcome?: string;
    payment?: string;
    report?: string;
    lessonPrep?: string;
  };
  absencePolicy?: {
    allowExcused?: boolean;
    requireMakeup?: boolean;
    autoCountExcused?: boolean;
  };
  onboardingCompleted?: boolean;
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

export function addStudentWithSchedules(
  teacherId: string,
  student: Omit<Student, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>,
  schedules: Array<Omit<ScheduleSlot, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>> = []
): { studentId: string; commitPromise: Promise<void> } {
  const path = `teachers/${teacherId}/students`;
  try {
    const batch = writeBatch(db);
    const colRef = collection(db, 'teachers', teacherId, 'students');
    const newDoc = doc(colRef);
    const studentId = newDoc.id;

    batch.set(newDoc, {
      ...student,
      id: studentId,
      teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const schedColRef = collection(db, 'teachers', teacherId, 'schedules');
    for (const s of schedules) {
      const newSchedDoc = doc(schedColRef);
      batch.set(newSchedDoc, {
        ...s,
        id: newSchedDoc.id,
        studentId,
        studentName: s.studentName || student.name,
        teacherId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const commitPromise = batch.commit();
    return { studentId, commitPromise };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
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

const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
let fcmRegisteredUid: string | null = null;
let fcmRegistrationPromise: Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> | null = null;

// Function to request permission and save FCM token for web push notifications
export async function requestAndSaveFCMToken(force = false): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const currentUser = auth?.currentUser;

  // Prevent redundant executions for the same user within the same session
  if (!force && currentUser && fcmRegisteredUid === currentUser.uid) {
    return { success: true };
  }

  // De-duplicate concurrent calls
  if (fcmRegistrationPromise) {
    return fcmRegistrationPromise;
  }

  fcmRegistrationPromise = (async () => {
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
          const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(firebaseConfig.apiKey || '')}&projectId=${encodeURIComponent(firebaseConfig.projectId || '')}&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId || '')}&appId=${encodeURIComponent(firebaseConfig.appId || '')}&authDomain=${encodeURIComponent(firebaseConfig.authDomain || '')}&storageBucket=${encodeURIComponent(firebaseConfig.storageBucket || '')}`;

          // Check if already registered for this scope first
          const existingReg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
          if (existingReg) {
            swReg = existingReg;
          } else {
            swReg = await navigator.serviceWorker.register(swUrl, { scope: FCM_SW_SCOPE });
          }
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

      const user = auth?.currentUser;
      if (user) {
        // Mark session as registered for this user
        fcmRegisteredUid = user.uid;

        // Unified storage: Save in teachers/{uid}/fcmTokens/{tokenId}
        const teacherTokenRef = doc(db, 'teachers', user.uid, 'fcmTokens', token);
        await setDoc(
          teacherTokenRef,
          {
            token,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
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
    } finally {
      fcmRegistrationPromise = null;
    }
  })();

  return fcmRegistrationPromise;
}

// ==========================================
// Phase 1: Workplaces & Groups Services + Migration
// ==========================================

export async function addWorkplace(
  teacherId: string,
  data: { name: string; type: WorkplaceType }
): Promise<string> {
  const path = `teachers/${teacherId}/workplaces`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'workplaces');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      id: newDoc.id,
      teacherId,
      name: data.name.trim(),
      type: data.type,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function updateWorkplace(
  teacherId: string,
  workplaceId: string,
  updates: Partial<{ name: string; type: WorkplaceType }>
) {
  const path = `teachers/${teacherId}/workplaces/${workplaceId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'workplaces', workplaceId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function deleteWorkplace(teacherId: string, workplaceId: string) {
  const path = `teachers/${teacherId}/workplaces/${workplaceId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'workplaces', workplaceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

// -------------------------------------------------------------
// Helper: Arabic Text Normalization & Unification
// -------------------------------------------------------------

/**
 * توحيد الحروف العربية وإزالة التشكيل والمحاذاة للمقارنة الدقيقة:
 * - تحويل [أإآٱ] إلى 'ا'
 * - تحويل [ة] إلى 'ه'
 * - تحويل [ى] إلى 'ي'
 * - إزالة التشكيل والتنوين
 * - إزالة المسافات المتكررة
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

export function subscribeToWorkplaces(
  teacherId: string,
  onUpdate: (workplaces: Workplace[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'teachers', teacherId, 'workplaces');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: Workplace[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as Workplace[];
      items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      onUpdate(items);
    },
    (err) => {
      console.error('Error in subscribeToWorkplaces:', err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// Educational Centers
// -------------------------------------------------------------

export async function addCenter(
  teacherId: string,
  name: string
): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('يرجى إدخال اسم السنتر');
  const path = `teachers/${teacherId}/centers`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'centers');
    // Fetch all centers with getDocs without where or orderBy
    const existing = await getDocs(colRef);
    const normalizedTarget = normalizeArabicText(cleanName);
    const foundDoc = existing.docs.find((d) => {
      const data = d.data() as EducationalCenter;
      if (data.archived) return false;
      return normalizeArabicText(data.name || '') === normalizedTarget;
    });

    if (foundDoc) {
      return foundDoc.id;
    }

    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      id: newDoc.id,
      ownerUid: teacherId,
      name: cleanName,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export function subscribeToCenters(
  teacherId: string,
  onUpdate: (centers: EducationalCenter[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'teachers', teacherId, 'centers');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: EducationalCenter[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as EducationalCenter[];
      items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      onUpdate(items);
    },
    (err) => {
      console.error('Error in subscribeToCenters:', err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// Groups
// -------------------------------------------------------------

export async function addGroup(
  teacherId: string,
  data: {
    name: string;
    centerId: string;
    centerName: string;
    subject: string;
    grade?: string;
    schedule: GroupScheduleItem[];
    monthlyFee: number;
    color?: string;
    status?: 'active' | 'paused';
    notes?: string;
    workplaceId?: string;
  }
): Promise<string> {
  const cleanName = data.name.trim();
  const cleanCenter = data.centerName.trim();
  if (!cleanName) throw new Error('يرجى إدخال اسم المجموعة');
  if (!cleanCenter) throw new Error('يرجى اختيار أو إدخال اسم السنتر');
  if (!data.subject?.trim()) throw new Error('يرجى تحديد المادة الدراسية');
  if (data.monthlyFee === undefined || data.monthlyFee < 0) throw new Error('يرجى تحديد سعر الشهر بشكل صحيح');

  const path = `teachers/${teacherId}/groups`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'groups');
    // Fetch all groups without where or orderBy
    const checkSnap = await getDocs(colRef);
    const targetName = normalizeArabicText(cleanName);
    const targetCenter = normalizeArabicText(cleanCenter);
    const hasDuplicate = checkSnap.docs.some((d) => {
      const g = d.data() as Group;
      if (g.archived) return false;
      return (
        normalizeArabicText(g.name || '') === targetName &&
        normalizeArabicText(g.centerName || '') === targetCenter
      );
    });

    if (hasDuplicate) {
      throw new Error(`توجد بالفعل مجموعة نشطة باسم "${cleanName}" في سنتر "${cleanCenter}". يرجى اختيار اسم مختلف.`);
    }

    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      id: newDoc.id,
      ownerUid: teacherId,
      teacherId,
      workplaceId: data.workplaceId || data.centerId,
      name: cleanName,
      centerId: data.centerId,
      centerName: cleanCenter,
      subject: data.subject.trim(),
      grade: data.grade?.trim() || '',
      schedule: data.schedule || [],
      monthlyFee: Number(data.monthlyFee) || 0,
      color: data.color || '#7c3aed',
      status: data.status || 'active',
      notes: data.notes?.trim() || '',
      active: (data.status || 'active') === 'active',
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function updateGroup(
  teacherId: string,
  groupId: string,
  updates: Partial<Group>
) {
  const path = `teachers/${teacherId}/groups/${groupId}`;
  try {
    // If name or centerName is being updated, check for duplicates
    if (updates.name || updates.centerName) {
      const colRef = collection(db, 'teachers', teacherId, 'groups');
      const checkSnap = await getDocs(colRef);
      const targetDoc = checkSnap.docs.find((d) => d.id === groupId);
      const currentData = targetDoc ? (targetDoc.data() as Group) : null;
      const targetName = normalizeArabicText(updates.name || currentData?.name || '');
      const targetCenter = normalizeArabicText(updates.centerName || currentData?.centerName || '');

      const hasDuplicate = checkSnap.docs.some((d) => {
        if (d.id === groupId) return false;
        const g = d.data() as Group;
        if (g.archived) return false;
        return (
          normalizeArabicText(g.name || '') === targetName &&
          normalizeArabicText(g.centerName || '') === targetCenter
        );
      });

      if (hasDuplicate) {
        throw new Error(`توجد بالفعل مجموعة نشطة بنفس الاسم في هذا السنتر.`);
      }
    }

    await updateDoc(doc(db, 'teachers', teacherId, 'groups', groupId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

// Soft delete (archive) group with undo capability
export async function archiveGroup(teacherId: string, groupId: string, archived: boolean = true) {
  const path = `teachers/${teacherId}/groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'groups', groupId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function deleteGroup(teacherId: string, groupId: string) {
  return archiveGroup(teacherId, groupId, true);
}

export async function deleteGroupPermanently(teacherId: string, groupId: string) {
  const path = `teachers/${teacherId}/groups/${groupId}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacherId, 'groups', groupId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

export function subscribeToGroups(
  teacherId: string,
  onUpdate: (groups: Group[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'teachers', teacherId, 'groups');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: Group[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as Group[];
      items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      onUpdate(items);
    },
    (err) => {
      console.error('Error in subscribeToGroups:', err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// Memberships (Student <-> Group relation with historical preservation)
// -------------------------------------------------------------

export function getMembershipId(studentId: string, groupId: string) {
  return `${studentId}_${groupId}`;
}

export async function addStudentToGroup(
  teacherId: string,
  studentId: string,
  groupId: string,
  studentName: string,
  groupName: string,
  centerName: string
) {
  const membershipId = getMembershipId(studentId, groupId);
  const path = `teachers/${teacherId}/memberships/${membershipId}`;
  try {
    const memRef = doc(db, 'teachers', teacherId, 'memberships', membershipId);
    await setDoc(
      memRef,
      {
        id: membershipId,
        ownerUid: teacherId,
        studentId,
        studentName,
        groupId,
        groupName,
        centerName,
        joinedAt: serverTimestamp(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Also update student's groupIds array and classType
    const studentRef = doc(db, 'teachers', teacherId, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const existing = studentSnap.data() as Student;
      const currentGroups = existing.groupIds || [];
      const updatedGroups = currentGroups.includes(groupId) ? currentGroups : [...currentGroups, groupId];
      await updateDoc(studentRef, {
        groupIds: updatedGroups,
        classType: 'center',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function removeStudentFromGroup(
  teacherId: string,
  studentId: string,
  groupId: string
) {
  const membershipId = getMembershipId(studentId, groupId);
  const path = `teachers/${teacherId}/memberships/${membershipId}`;
  try {
    const memRef = doc(db, 'teachers', teacherId, 'memberships', membershipId);
    // Mark membership inactive and record leftAt so history is preserved
    await updateDoc(memRef, {
      active: false,
      leftAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const studentRef = doc(db, 'teachers', teacherId, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const existing = studentSnap.data() as Student;
      const currentGroups = (existing.groupIds || []).filter((g) => g !== groupId);
      await updateDoc(studentRef, {
        groupIds: currentGroups,
        classType: currentGroups.length > 0 ? 'center' : 'private',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function moveStudentGroup(
  teacherId: string,
  studentId: string,
  studentName: string,
  fromGroupId: string,
  toGroupId: string,
  toGroupName: string,
  toCenterName: string
) {
  const batch = writeBatch(db);

  // 1. Deactivate old membership
  const oldMemId = getMembershipId(studentId, fromGroupId);
  const oldRef = doc(db, 'teachers', teacherId, 'memberships', oldMemId);
  batch.update(oldRef, {
    active: false,
    leftAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Activate or create new membership
  const newMemId = getMembershipId(studentId, toGroupId);
  const newRef = doc(db, 'teachers', teacherId, 'memberships', newMemId);
  batch.set(
    newRef,
    {
      id: newMemId,
      ownerUid: teacherId,
      studentId,
      studentName,
      groupId: toGroupId,
      groupName: toGroupName,
      centerName: toCenterName,
      joinedAt: serverTimestamp(),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3. Update student record
  const studentRef = doc(db, 'teachers', teacherId, 'students', studentId);
  const studentSnap = await getDoc(studentRef);
  if (studentSnap.exists()) {
    const existing = studentSnap.data() as Student;
    const currentGroups = (existing.groupIds || []).filter((g) => g !== fromGroupId);
    const updatedGroups = currentGroups.includes(toGroupId) ? currentGroups : [...currentGroups, toGroupId];
    batch.update(studentRef, {
      groupIds: updatedGroups,
      classType: 'center',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function convertStudentToIndividual(
  teacherId: string,
  studentId: string,
  fromGroupId?: string
) {
  const batch = writeBatch(db);

  if (fromGroupId) {
    const oldMemId = getMembershipId(studentId, fromGroupId);
    const oldRef = doc(db, 'teachers', teacherId, 'memberships', oldMemId);
    batch.update(oldRef, {
      active: false,
      leftAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const studentRef = doc(db, 'teachers', teacherId, 'students', studentId);
  batch.update(studentRef, {
    groupIds: [],
    classType: 'private',
    isIndividual: true,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

// Bulk add students to a group from newline-separated names
export async function bulkAddStudentsToGroup(
  teacherId: string,
  groupId: string,
  groupName: string,
  centerName: string,
  studentNames: string[],
  subject: string = 'عام',
  hourlyRate: number = 100
): Promise<number> {
  const cleanNames = studentNames
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  if (cleanNames.length === 0) return 0;

  const batch = writeBatch(db);

  for (const name of cleanNames) {
    const studentRef = doc(collection(db, 'teachers', teacherId, 'students'));
    const studentId = studentRef.id;

    batch.set(studentRef, {
      id: studentId,
      teacherId,
      ownerUid: teacherId,
      name,
      phone: '',
      parentPhone: '',
      whatsapp: '',
      subject,
      classType: 'center',
      billingType: 'monthly',
      hourlyRate,
      monthlyFee: hourlyRate,
      pendingDues: 0,
      totalHours: 0,
      collectedDues: 0,
      paymentStatus: 'unpaid',
      groupIds: [groupId],
      active: true,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const memId = getMembershipId(studentId, groupId);
    const memRef = doc(db, 'teachers', teacherId, 'memberships', memId);
    batch.set(memRef, {
      id: memId,
      ownerUid: teacherId,
      studentId,
      studentName: name,
      groupId,
      groupName,
      centerName,
      joinedAt: serverTimestamp(),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return cleanNames.length;
}

export function subscribeToMemberships(
  teacherId: string,
  onUpdate: (memberships: GroupMembership[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'teachers', teacherId, 'memberships');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: GroupMembership[] = snap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as GroupMembership[];
      items.sort((a, b) => {
        const tA = (a.createdAt as any)?.toMillis?.() || 0;
        const tB = (b.createdAt as any)?.toMillis?.() || 0;
        return tB - tA;
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error in subscribeToMemberships:', err);
      if (onError) onError(err);
    }
  );
}

// Soft delete (archive) student with undo support
export async function archiveStudent(teacherId: string, studentId: string, archived: boolean = true) {
  const path = `teachers/${teacherId}/students/${studentId}`;
  try {
    await updateDoc(doc(db, 'teachers', teacherId, 'students', studentId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

// Idempotent Migration: Ensures default workplaces (Private and Online) exist for existing teachers
export async function ensureDefaultWorkplacesAndMigration(teacherId: string): Promise<void> {
  if (!teacherId) return;
  try {
    const wpSnap = await getDocs(collection(db, 'teachers', teacherId, 'workplaces'));
    if (wpSnap.empty) {
      const batch = writeBatch(db);
      
      const privRef = doc(collection(db, 'teachers', teacherId, 'workplaces'));
      batch.set(privRef, {
        id: privRef.id,
        teacherId,
        name: 'دروس خصوصية (منزلية / خاصة)',
        type: 'private',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const onlineRef = doc(collection(db, 'teachers', teacherId, 'workplaces'));
      batch.set(onlineRef, {
        id: onlineRef.id,
        teacherId,
        name: 'دروس أونلاين (عن بعد)',
        type: 'online',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      console.log('Default workplaces successfully provisioned for teacher:', teacherId);
    }
  } catch (err) {
    console.warn('Migration check warning:', err);
  }
}

export async function recordStudentAttendance(
  teacherId: string,
  data: {
    studentId: string;
    studentName: string;
    subject: string;
    status: 'present' | 'absent' | 'late';
    date: string; // YYYY-MM-DD
    notes?: string;
  }
): Promise<string> {
  const path = `teachers/${teacherId}/attendance`;
  try {
    const colRef = collection(db, 'teachers', teacherId, 'attendance');
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      id: newDoc.id,
      teacherId,
      studentId: data.studentId,
      studentName: data.studentName,
      subject: data.subject,
      status: data.status,
      date: data.date,
      notes: data.notes?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDoc.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export function getPaymentRecordId(studentId: string, groupId: string | null | undefined, month: string): string {
  const gId = groupId && groupId.trim() ? groupId.trim() : 'individual';
  return `${studentId}_${gId}_${month}`;
}

export async function recordStudentPayment(
  teacherId: string,
  record: {
    studentId: string;
    studentName?: string;
    groupId?: string | null;
    groupName?: string;
    month: string; // YYYY-MM
    status: PaymentStatus;
    amountPaid: number;
    amountDue: number;
    notes?: string;
  }
) {
  const paymentId = getPaymentRecordId(record.studentId, record.groupId, record.month);
  const path = `teachers/${teacherId}/payments/${paymentId}`;
  try {
    const paymentRef = doc(db, 'teachers', teacherId, 'payments', paymentId);
    await setDoc(
      paymentRef,
      {
        id: paymentId,
        teacherId,
        studentId: record.studentId,
        studentName: record.studentName || '',
        groupId: record.groupId || 'individual',
        groupName: record.groupName || '',
        month: record.month,
        status: record.status,
        amountPaid: record.amountPaid,
        amountDue: record.amountDue,
        notes: record.notes || '',
        paidAt: record.status === 'paid' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Also update student document directly for quick querying/filtering
    const studentRef = doc(db, 'teachers', teacherId, 'students', record.studentId);
    await updateDoc(studentRef, {
      paymentStatus: record.status,
      lastPaymentMonth: record.month,
      collectedDues: record.amountPaid,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    return paymentId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export function subscribeToMonthlyPayments(
  teacherId: string,
  month: string,
  callback: (records: StudentPaymentRecord[]) => void
) {
  const collRef = collection(db, 'teachers', teacherId, 'payments');
  return onSnapshot(
    collRef,
    (snapshot) => {
      const list: StudentPaymentRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.month === month) {
          list.push({
            id: docSnap.id,
            ...data,
          } as StudentPaymentRecord);
        }
      });
      callback(list);
    },
    (err) => {
      console.error('Error in payments subscription:', err);
      callback([]);
    }
  );
}

export function subscribeToAllPayments(
  teacherId: string,
  callback: (records: StudentPaymentRecord[]) => void
) {
  const collRef = collection(db, 'teachers', teacherId, 'payments');
  return onSnapshot(
    collRef,
    (snapshot) => {
      const list: StudentPaymentRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as StudentPaymentRecord);
      });
      callback(list);
    },
    (err) => {
      console.error('Error in all payments subscription:', err);
      callback([]);
    }
  );
}

export async function updateStudentPaymentStatus(
  teacherId: string,
  studentId: string,
  isPaid: boolean,
  amount: number,
  groupId: string | null = null,
  month?: string
) {
  const currentMonth = month || new Date().toISOString().substring(0, 7);
  return recordStudentPayment(teacherId, {
    studentId,
    groupId,
    month: currentMonth,
    status: isPaid ? 'paid' : 'unpaid',
    amountPaid: isPaid ? amount : 0,
    amountDue: amount,
  });
}

export interface AdminNotification {
  id: string;
  type: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  whatsapp: string;
  subject: string;
  createdAt: any;
  read: boolean;
}

export function subscribeToAdminNotifications(callback: (notifications: AdminNotification[]) => void) {
  const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const list: AdminNotification[] = [];
    snapshot.forEach((docSnap) => {
      list.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as AdminNotification);
    });
    callback(list);
  }, (err) => {
    console.error('Error subscribing to admin notifications:', err);
    callback([]);
  });
}







