import { Router } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveDatabaseId } from '../../server.js';

function getAdminDb() {
  const dbId = resolveDatabaseId();
  const appAdmin = getApps()[0];
  return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
}

export function generateReferralCodeForUid(uid: string): string {
  const clean = (uid || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const code = clean.length >= 6 ? clean.slice(0, 6) : (clean + 'SANAD').slice(0, 6);
  return `SANAD-${code}`;
}

export function createReferralRouter(): Router {
  const router = Router();

  // Get current teacher's referral info
  router.get('/stats', async (req, res) => {
    try {
      const uid = (req as any).user?.uid;
      if (!uid) return res.status(401).json({ error: 'غير مصرح به.' });

      const db = getAdminDb();
      const teacherDoc = await db.collection('teachers').doc(uid).get();
      const data = teacherDoc.data() || {};

      const referralCode = data.referralCode || generateReferralCodeForUid(uid);
      const referralCount = Number(data.referralCount) || 0;
      const referralRewardsDays = Number(data.referralRewardsDays) || 0;

      return res.json({
        success: true,
        referralCode,
        referralCount,
        referralRewardsDays,
        requiredForReward: 3,
        rewardDays: 30,
      });
    } catch (err: any) {
      console.error('Error in GET /api/referrals/stats:', err);
      return res.status(500).json({ error: 'فشل جلب بيانات نظام الإحالة.' });
    }
  });

  // Register a referral code when a new teacher signs up or applies a code
  router.post('/register', async (req, res) => {
    try {
      const uid = (req as any).user?.uid;
      if (!uid) return res.status(401).json({ error: 'غير مصرح به.' });

      const { referralCode } = req.body;
      if (!referralCode || typeof referralCode !== 'string') {
        return res.status(400).json({ error: 'رمز الإحالة مطلوب.' });
      }

      const formattedCode = referralCode.trim().toUpperCase();
      const db = getAdminDb();

      // 1. Prevent self referral
      const myCode = generateReferralCodeForUid(uid);
      if (formattedCode === myCode) {
        return res.status(400).json({ error: 'لا يمكنك استخدام رمز الإحالة الخاص بك.' });
      }

      // 2. Check if user already used a referral code
      const refereeRef = db.collection('teachers').doc(uid);
      const refereeDoc = await refereeRef.get();
      if (!refereeDoc.exists) {
        return res.status(404).json({ error: 'لم يتم العثور على حساب المعلم.' });
      }

      const refereeData = refereeDoc.data() || {};
      if (refereeData.referredBy) {
        return res.status(400).json({ error: 'تم تسجيل إحالة لهذا الحساب مسبقاً.' });
      }

      // 3. Find the referrer teacher by code or UID prefix
      let referrerUid: string | null = null;
      const codeMatch = formattedCode.replace(/^SANAD-/, '');

      const teachersSnap = await db.collection('teachers').get();
      for (const doc of teachersSnap.docs) {
        if (doc.id === uid) continue;
        const d = doc.data() || {};
        const expectedCode = d.referralCode || generateReferralCodeForUid(doc.id);
        if (expectedCode === formattedCode || generateReferralCodeForUid(doc.id).endsWith(codeMatch)) {
          referrerUid = doc.id;
          break;
        }
      }

      if (!referrerUid) {
        return res.status(404).json({ error: 'رمز الإحالة غير صحيح أو غير موجود.' });
      }

      // 4. Atomic transaction to register referral and grant reward if threshold reached
      let rewardGranted = false;
      await db.runTransaction(async (transaction) => {
        const refDoc = await transaction.get(refereeRef);
        if (refDoc.data()?.referredBy) {
          throw new Error('already_referred');
        }

        const referrerRef = db.collection('teachers').doc(referrerUid!);
        const referrerDoc = await transaction.get(referrerRef);
        const referrerData = referrerDoc.data() || {};

        const newReferralCount = (Number(referrerData.referralCount) || 0) + 1;
        const currentRewardDays = Number(referrerData.referralRewardsDays) || 0;

        // Reward: Every 3 referrals grants 30 days Pro
        const shouldReward = newReferralCount % 3 === 0;
        rewardGranted = shouldReward;

        const referrerUpdates: Record<string, any> = {
          referralCount: newReferralCount,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (shouldReward) {
          referrerUpdates.referralRewardsDays = currentRewardDays + 30;
          referrerUpdates.subscriptionStatus = 'active';

          // Extend subscription date by 30 days safely
          const currentExpiry = referrerData.subscriptionEndDate || referrerData.subscriptionExpiresAt;
          let expiryDate = new Date();
          if (currentExpiry) {
            const parsed = currentExpiry.toDate ? currentExpiry.toDate() : new Date(currentExpiry);
            if (!isNaN(parsed.getTime()) && parsed > expiryDate) {
              expiryDate = parsed;
            }
          }
          const newExpiryDate = new Date(expiryDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          referrerUpdates.subscriptionEndDate = Timestamp.fromDate(newExpiryDate);
          referrerUpdates.subscriptionExpiresAt = Timestamp.fromDate(newExpiryDate);
        }

        transaction.update(referrerRef, referrerUpdates);
        transaction.update(refereeRef, {
          referredBy: referrerUid,
          referredWithCode: formattedCode,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return res.json({
        success: true,
        message: 'تم تفعيل كود الإحالة بنجاح! شكراً لانضمامك إلى سند المعلم.',
        rewardGranted,
      });
    } catch (err: any) {
      if (err.message === 'already_referred') {
        return res.status(400).json({ error: 'تم تسجيل إحالة لهذا الحساب مسبقاً.' });
      }
      console.error('Error in POST /api/referrals/register:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء معالجة رمز الإحالة.' });
    }
  });

  return router;
}
