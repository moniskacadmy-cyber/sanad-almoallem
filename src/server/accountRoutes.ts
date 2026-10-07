import { Router, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export function resolveDatabaseId(): string | undefined {
  const effective =
    process.env.VITE_FIREBASE_DATABASE_ID?.trim() ||
    process.env.FIREBASE_DATABASE_ID?.trim() ||
    '';
  return !effective || effective === '(default)' ? undefined : effective;
}

// Disposable / temporary email domains list
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mohmal.com',
  'dispostable.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
  'throwawaymail.com',
  'fakeinbox.com',
]);

/**
 * Check if an email uses a known temporary/disposable domain or subdomain
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return false;
  const domain = trimmed.slice(atIdx + 1);
  if (!domain || !domain.includes('.')) return false;

  for (const disp of DISPOSABLE_DOMAINS) {
    if (domain === disp || domain.endsWith('.' + disp)) {
      return true;
    }
  }
  return false;
}

// In-memory IP tracking for account registration & init attempts
const accountInitIpMemory = new Map<string, { count: number; expiresAt: number }>();

export function clearAccountInitIpMemory(): void {
  accountInitIpMemory.clear();
}

export function checkAndIncrementAccountInitIpMemory(ip: string, maxAttempts = 5, windowMs = 3600000): boolean {
  if (!ip) return true;
  const now = Date.now();
  const record = accountInitIpMemory.get(ip);
  if (!record || record.expiresAt <= now) {
    accountInitIpMemory.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count += 1;
  return true;
}

export function createAccountRouter() {
  const router = Router();

  function getDb() {
    const dbId = resolveDatabaseId();
    const appAdmin = getApps()[0];
    return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
  }

  /**
   * POST /api/account/init
   * Validates account initialization against disposable emails and spam IP rate limits.
   */
  router.post('/init', async (req: Request, res: Response) => {
    try {
      const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim();
      if (clientIp && !checkAndIncrementAccountInitIpMemory(clientIp)) {
        return res.status(429).json({ error: 'تم تجاوز الحد الأقصى للمحاولات المسموح بها من هذا العنوان. يرجى الانتظار.' });
      }

      const email = (req.user?.email || req.body?.email || '').trim();
      if (email && isDisposableEmail(email)) {
        return res.status(400).json({ error: 'عفواً، لا يُسمح باستخدام بريد إلكتروني مؤقت أو وهمي. يرجى استخدام بريد إلكتروني حقيقي.' });
      }

      const user = req.user;
      if (!user || !user.uid) {
        return res.status(200).json({ success: true, message: 'البريد الإلكتروني صالح ومقبول.' });
      }

      const uid = user.uid;
      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(uid);
      const teacherSnap = await teacherRef.get();

      if (!teacherSnap.exists) {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        await teacherRef.set({
          name: user.name || req.body?.name || 'معلم جديد',
          email: (user.email || '').toLowerCase().trim(),
          phone: req.body?.phone || '',
          subscriptionStatus: 'trial',
          trialStartDate: now.toISOString(),
          trialEndDate: trialEnd.toISOString(),
          createdAt: now.toISOString(),
          status: 'active',
        }, { merge: true });
      }

      return res.status(200).json({ success: true, message: 'تم تهيئة الحساب بنجاح.' });
    } catch (err: any) {
      console.error('Account init error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تهيئة الحساب.' });
    }
  });

  /**
   * POST /api/account/delete
   * GDPR / Right to be Forgotten: Permanently deletes teacher and all associated data.
   */
  router.post('/delete', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'غير مصرح به: يرجى تسجيل الدخول.' });
      }

      const uid = user.uid;
      const userEmail = (user.email || '').toLowerCase().trim();
      const dbAdmin = getDb();
      const adminAuth = getAuth();

      // 1. Check if teacher doc exists
      const teacherRef = dbAdmin.collection('teachers').doc(uid);
      const teacherSnap = await teacherRef.get();
      if (!teacherSnap.exists) {
        return res.status(404).json({ error: 'حساب المعلم غير موجود أو تم حذفه مسبقاً.' });
      }

      // 2. Delete all reminderQueue documents for this teacher
      try {
        const remindersSnap = await dbAdmin
          .collection('reminderQueue')
          .where('teacherId', '==', uid)
          .get();
        if (!remindersSnap.empty) {
          const batch = dbAdmin.batch();
          remindersSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error clearing reminderQueue for deleted teacher:', err);
      }

      // 3. Delete subscriptions document for this teacher if exists
      if (userEmail) {
        try {
          await dbAdmin.collection('subscriptions').doc(userEmail).delete();
        } catch (err) {
          console.warn('Error deleting subscriptions doc for user:', err);
        }
      }

      // 4. Delete Storage files for this teacher (profile pictures, library files, etc.)
      try {
        const appAdmin = getApps()[0];
        const bucket = getStorage(appAdmin).bucket();
        await bucket.deleteFiles({ prefix: `teachers/${uid}/` }).catch(() => {});
        await bucket.deleteFiles({ prefix: `library/${uid}/` }).catch(() => {});
      } catch (_) {
        // Storage bucket may not be configured in all environments
      }

      // 5. Recursively delete the entire teachers/{uid} document and all subcollections
      // (students, lessons, reports, schedules, library, notes, fcmTokens)
      await dbAdmin.recursiveDelete(teacherRef);

      // 6. Delete user from Firebase Authentication
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: any) {
        if (authErr?.code !== 'auth/user-not-found') {
          console.warn('Error deleting auth user:', authErr);
        }
      }

      // 7. Audit log (without PII)
      try {
        await dbAdmin.collection('auditLogs').add({
          action: 'teacher_self_delete_account',
          targetTeacherId: uid,
          timestamp: new Date().toISOString(),
          ip: req.ip || '',
        });
      } catch (_) {}

      return res.status(200).json({
        success: true,
        message: 'تم حذف الحساب وكافة البيانات المرتبطة به نهائياً بنجاح.',
      });
    } catch (err: any) {
      console.error('Account deletion error:', err);
      return res.status(500).json({ error: 'فشل حذف الحساب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.' });
    }
  });

  /**
   * GET /api/account/export
   * Export all teacher data in structured JSON
   */
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'غير مصرح به: يرجى تسجيل الدخول.' });
      }

      const uid = user.uid;
      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(uid);
      const teacherSnap = await teacherRef.get();

      if (!teacherSnap.exists) {
        return res.status(404).json({ error: 'بيانات المعلم غير موجودة.' });
      }

      const profile = { id: teacherSnap.id, ...teacherSnap.data() };

      // Read subcollections
      const [studentsSnap, schedulesSnap, librarySnap] = await Promise.all([
        teacherRef.collection('students').get(),
        teacherRef.collection('schedules').get(),
        teacherRef.collection('library').get(),
      ]);

      const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const schedules = schedulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const library = librarySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fetch lessons for each student
      const lessonsByStudent: Record<string, any[]> = {};
      for (const stDoc of studentsSnap.docs) {
        const lessonsSnap = await stDoc.ref.collection('lessons').get();
        lessonsByStudent[stDoc.id] = lessonsSnap.docs.map((ld) => ({ id: ld.id, ...ld.data() }));
      }

      const exportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        teacherId: uid,
        profile,
        students,
        schedules,
        library,
        lessons: lessonsByStudent,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="sanad_data_${new Date().toISOString().slice(0, 10)}.json"`);
      return res.status(200).json(exportPayload);
    } catch (err: any) {
      console.error('Account export error:', err);
      return res.status(500).json({ error: 'فشل تصدير البيانات.' });
    }
  });

  return router;
}
