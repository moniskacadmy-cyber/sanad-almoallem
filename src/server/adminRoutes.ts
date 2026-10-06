import { Router, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { calculateExtendedSubscriptionDates, BILLING_PLANS } from './billing.js';
import { resolveDatabaseId } from '../../server.js';

export function createAdminRouter() {
  const router = Router();

  function getDb() {
    const dbId = resolveDatabaseId();
    const appAdmin = getApps()[0];
    return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
  }

  // Middleware to ensure user is an Admin via admins/{uid} document
  const requireAdminPrivilege = async (req: Request, res: Response, next: () => void) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول.' });
      }

      const dbAdmin = getDb();
      const adminDoc = await dbAdmin.collection('admins').doc(user.uid).get();
      if (!adminDoc.exists) {
        return res.status(403).json({ error: 'مطلوب صلاحيات المشرف للقيام بهذه العملية.' });
      }

      next();
    } catch (err) {
      console.error('Admin authorization error:', err);
      return res.status(500).json({ error: 'فشل التحقق من صلاحيات المشرف.' });
    }
  };

  router.use(requireAdminPrivilege);

  /**
   * POST /api/admin/subscription/extend
   */
  router.post('/subscription/extend', async (req: Request, res: Response) => {
    try {
      const { teacherId, days = 30, plan = 'monthly', reason = 'Admin grant' } = req.body;
      if (!teacherId || typeof teacherId !== 'string') {
        return res.status(400).json({ error: 'معرّف المعلم (teacherId) مطلوب.' });
      }

      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(teacherId);
      const teacherDoc = await teacherRef.get();

      if (!teacherDoc.exists) {
        return res.status(404).json({ error: 'المعلم غير موجود.' });
      }

      const teacherData = teacherDoc.data();
      const currentEnd = teacherData?.subscriptionEndDate || teacherData?.subscriptionExpiresAt || teacherData?.trialEndDate;
      const { endDate: newEndIso } = calculateExtendedSubscriptionDates(currentEnd, Number(days) || 30);

      const nowIso = new Date().toISOString();

      await teacherRef.update({
        subscriptionStatus: 'active',
        plan: plan || 'monthly',
        isActive: true,
        subscriptionEndDate: newEndIso,
        subscriptionExpiresAt: newEndIso,
        updatedAt: nowIso,
      });

      // Audit Log
      await dbAdmin.collection('auditLogs').add({
        action: 'admin_extend_subscription',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        targetTeacherId: teacherId,
        days,
        plan,
        newEndDate: newEndIso,
        reason,
        timestamp: nowIso,
      });

      return res.status(200).json({ success: true, newEndDate: newEndIso });
    } catch (err: any) {
      console.error('Error extending subscription:', err);
      return res.status(500).json({ error: 'فشل تمديد الاشتراك.' });
    }
  });

  /**
   * POST /api/admin/subscription/custom-expiry
   */
  router.post('/subscription/custom-expiry', async (req: Request, res: Response) => {
    try {
      const { teacherId, expiryDate, plan = 'monthly', reason = 'Custom expiry set' } = req.body;
      if (!teacherId || !expiryDate) {
        return res.status(400).json({ error: 'البيانات المطلوبة ناقصة.' });
      }

      const targetDate = new Date(expiryDate);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'تاريخ انتهاء غير صالح.' });
      }

      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(teacherId);
      const nowIso = new Date().toISOString();
      const targetIso = targetDate.toISOString();

      await teacherRef.update({
        subscriptionStatus: targetDate > new Date() ? 'active' : 'expired',
        plan,
        isActive: targetDate > new Date(),
        subscriptionEndDate: targetIso,
        subscriptionExpiresAt: targetIso,
        updatedAt: nowIso,
      });

      await dbAdmin.collection('auditLogs').add({
        action: 'admin_set_custom_expiry',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        targetTeacherId: teacherId,
        newEndDate: targetIso,
        reason,
        timestamp: nowIso,
      });

      return res.status(200).json({ success: true, newEndDate: targetIso });
    } catch (err: any) {
      console.error('Error setting custom expiry:', err);
      return res.status(500).json({ error: 'فشل تعيين تاريخ الانتهاء المخصص.' });
    }
  });

  /**
   * POST /api/admin/teacher/toggle-active
   */
  router.post('/teacher/toggle-active', async (req: Request, res: Response) => {
    try {
      const { teacherId, isActive, reason = 'Admin state toggle' } = req.body;
      if (!teacherId || typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'البيانات المطلوبة ناقصة.' });
      }

      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(teacherId);
      const nowIso = new Date().toISOString();

      await teacherRef.update({
        isActive,
        updatedAt: nowIso,
      });

      await dbAdmin.collection('auditLogs').add({
        action: 'admin_toggle_teacher_active',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        targetTeacherId: teacherId,
        isActive,
        reason,
        timestamp: nowIso,
      });

      return res.status(200).json({ success: true, isActive });
    } catch (err: any) {
      console.error('Error toggling teacher status:', err);
      return res.status(500).json({ error: 'فشل تغيير حالة المعلم.' });
    }
  });

  /**
   * POST /api/admin/teacher/reset-trial
   */
  router.post('/teacher/reset-trial', async (req: Request, res: Response) => {
    try {
      const { teacherId, reason = 'Admin reset trial' } = req.body;
      if (!teacherId) {
        return res.status(400).json({ error: 'معرّف المعلم مطلوب.' });
      }

      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(teacherId);
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nowIso = now.toISOString();
      const trialEndIso = trialEnd.toISOString();

      await teacherRef.update({
        subscriptionStatus: 'trial',
        isActive: true,
        trialStartDate: nowIso,
        trialEndDate: trialEndIso,
        subscriptionEndDate: trialEndIso,
        subscriptionExpiresAt: trialEndIso,
        updatedAt: nowIso,
      });

      await dbAdmin.collection('auditLogs').add({
        action: 'admin_reset_trial',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        targetTeacherId: teacherId,
        newTrialEndDate: trialEndIso,
        reason,
        timestamp: nowIso,
      });

      return res.status(200).json({ success: true, trialEndDate: trialEndIso });
    } catch (err: any) {
      console.error('Error resetting trial:', err);
      return res.status(500).json({ error: 'فشل إعادة ضبط التجربة.' });
    }
  });

  /**
   * POST /api/admin/teacher/delete
   */
  router.post('/teacher/delete', async (req: Request, res: Response) => {
    try {
      const { teacherId, reason = 'Admin delete account' } = req.body;
      if (!teacherId) {
        return res.status(400).json({ error: 'معرّف المعلم مطلوب.' });
      }

      const dbAdmin = getDb();
      await dbAdmin.collection('teachers').doc(teacherId).delete();

      await dbAdmin.collection('auditLogs').add({
        action: 'admin_delete_teacher',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        targetTeacherId: teacherId,
        reason,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('Error deleting teacher:', err);
      return res.status(500).json({ error: 'فشل حذف حساب المعلم.' });
    }
  });

  return router;
}
