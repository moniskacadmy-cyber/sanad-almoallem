import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-sanad';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [HOST, PORT] = EMULATOR_HOST.split(':');
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [AUTH_HOSTNAME, AUTH_PORT] = AUTH_HOST.replace(/^https?:\/\//, '').split(':');

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let adminDb: ReturnType<typeof getAdminFirestore>;
let uid = '';

before(async () => {
  if (!getApps().length) initializeAdminApp({ projectId: PROJECT_ID });
  adminDb = getAdminFirestore();
  app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  }, `rules-test-${Date.now()}`);
  auth = getAuth(app);
  db = getFirestore(app);
  connectAuthEmulator(auth, `http://${AUTH_HOSTNAME}:${AUTH_PORT}`);
  connectFirestoreEmulator(db, HOST, Number(PORT));
  const credential = await createUserWithEmailAndPassword(auth, `rules-${Date.now()}@example.test`, 'Password123!');
  uid = credential.user.uid;
  await getAdminAuth().updateUser(uid, { emailVerified: true });
  await credential.user.reload();
});

after(async () => {
  await deleteApp(app);
});

test('teacher can create a legitimate 7-day trial', async () => {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const teacher = doc(db, 'teachers', uid);
  await setDoc(teacher, {
    id: uid,
    name: 'Rules Test Teacher',
    email: auth.currentUser!.email,
    whatsapp: '01000000000',
    subject: 'Math',
    role: 'teacher',
    subscriptionStatus: 'trial',
    plan: 'none',
    isActive: true,
    subscriptionEndDate: trialEnd,
    trialStartDate: serverTimestamp(),
    trialEndDate: trialEnd,
    subscriptionExpiresAt: trialEnd,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  assert.equal((await getDoc(teacher)).exists(), true);
});

test('teacher can update reminder preferences but cannot change role or subscription expiry', async () => {
  const teacher = doc(db, 'teachers', uid);
  const before = (await getDoc(teacher)).data()!;
  await updateDoc(teacher, {
    reminderMinutesBefore: 30,
    remindersEnabled: true,
    teacherNotificationsEnabled: false,
    timezone: 'Africa/Cairo',
    updatedAt: serverTimestamp(),
  });
  const updated = (await getDoc(teacher)).data()!;
  assert.equal(updated.reminderMinutesBefore, 30);
  assert.equal(updated.remindersEnabled, true);
  assert.equal(updated.teacherNotificationsEnabled, false);
  assert.equal(updated.timezone, 'Africa/Cairo');

  await assert.rejects(() => updateDoc(teacher, {
    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    updatedAt: serverTimestamp(),
  }));
  await assert.rejects(() => updateDoc(teacher, {
    role: 'admin',
    updatedAt: serverTimestamp(),
  }));
  assert.equal((await getDoc(teacher)).data()?.role, before.role);
});

test('unverified email cannot claim a pre-provisioned subscription', async () => {
  const email = `unverified-1791215690623@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, 'Password123!');
  const unverifiedUid = credential.user.uid;
  await adminDb.collection('subscriptions').doc(email).set({
    email,
    isActive: true,
    plan: 'monthly',
    subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await assert.rejects(() => setDoc(doc(db, 'teachers', unverifiedUid), {
    id: unverifiedUid,
    name: 'Unverified Teacher',
    email,
    whatsapp: '01000000000',
    subject: 'Math',
    role: 'teacher',
    subscriptionStatus: 'active',
    plan: 'monthly',
    isActive: true,
    subscriptionEndDate: end,
    trialStartDate: serverTimestamp(),
    trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    subscriptionExpiresAt: end,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('teacher cannot read or write sentReminders', async () => {
  const reminder = doc(db, 'teachers', uid, 'sentReminders', 'rules-test');
  await assert.rejects(() => getDoc(reminder));
  await assert.rejects(() => setDoc(reminder, { status: 'sent' }));
});

test('teacher cannot forge a longer subscription at creation', async () => {
  const other = doc(db, 'teachers', `${uid}-forged`);
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const forgedEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await assert.rejects(() => setDoc(other, {
    id: `${uid}-forged`,
    name: 'Forged Teacher',
    email: auth.currentUser!.email,
    whatsapp: '01000000000',
    subject: 'Math',
    role: 'teacher',
    subscriptionStatus: 'trial',
    plan: 'none',
    isActive: true,
    subscriptionEndDate: forgedEnd,
    trialStartDate: serverTimestamp(),
    trialEndDate: trialEnd,
    subscriptionExpiresAt: trialEnd,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('active teacher can create student data', async () => {
  const student = doc(db, 'teachers', uid, 'students', 'student-1');
  await setDoc(student, {
    teacherId: uid,
    name: 'Student One',
    subject: 'Math',
    classType: 'online',
    paymentStatus: 'paid',
  });
  assert.equal((await getDoc(student)).exists(), true);
});

test('expired teacher cannot create new student data', async () => {
  await adminDb.collection('teachers').doc(uid).set({
    isActive: true,
    subscriptionExpiresAt: new Date(Date.now() - 60_000),
    subscriptionEndDate: new Date(Date.now() - 60_000),
  }, { merge: true });
  const student = doc(db, 'teachers', uid, 'students', 'student-expired');
  await assert.rejects(() => setDoc(student, {
    teacherId: uid,
    name: 'Blocked Student',
    subject: 'Math',
    classType: 'online',
    paymentStatus: 'paid',
  }));
});

test('teacher cannot read another teacher profile', async () => {
  await adminDb.collection('teachers').doc('other-teacher').set({
    id: 'other-teacher',
    name: 'Other Teacher',
    email: 'other@example.test',
  });
  await assert.rejects(() => getDoc(doc(db, 'teachers', 'other-teacher')));
});
