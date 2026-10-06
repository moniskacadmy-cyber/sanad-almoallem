import { Router, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  BILLING_PLANS,
  verifyBillingHmacSignature,
  calculateExtendedSubscriptionDates,
} from './billing.js';
import { resolveDatabaseId } from '../../server.js';

export function createBillingRouter() {
  const router = Router();

  function getDb() {
    const dbId = resolveDatabaseId();
    const appAdmin = getApps()[0];
    return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
  }

  /**
   * POST /api/billing/checkout
   * Generates a checkout session for the authenticated user.
   */
  router.post('/checkout', async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للبدء بالدفع.' });
      }

      const { planId = 'monthly' } = req.body;
      const plan = BILLING_PLANS[planId];
      if (!plan) {
        return res.status(400).json({ error: 'خطة الاشتراك المحددة غير صالحة.' });
      }

      // Metadata with UID to tie the payment strictly to the user
      const metadata = {
        uid: user.uid,
        email: user.email || '',
        planId: plan.id,
      };

      // Construct payment session / link (supports Paymob / Stripe / Direct checkout)
      const paymobIframeId = process.env.PAYMOB_IFRAME_ID;
      const paymobBaseUrl = 'https://accept.paymobsolutions.com/api/acceptance/iframes';

      let checkoutUrl = `${req.protocol}://${req.get('host')}/?payment_status=pending&plan=${plan.id}`;

      if (paymobIframeId) {
        checkoutUrl = `${paymobBaseUrl}/${paymobIframeId}?uid=${encodeURIComponent(user.uid)}&plan=${plan.id}`;
      }

      return res.status(200).json({
        success: true,
        plan,
        checkoutUrl,
        metadata,
      });
    } catch (err: any) {
      console.error('Error in /api/billing/checkout:', err);
      return res.status(500).json({ error: 'تعذر إنشاء جلسة الدفع.' });
    }
  });

  /**
   * POST /api/billing/webhook
   * Processes payment gateway webhooks with HMAC validation, idempotency, and audit logging.
   */
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const signatureHeader =
        (req.headers['x-paymob-hmac'] as string) ||
        (req.headers['stripe-signature'] as string) ||
        (req.headers['x-billing-signature'] as string) ||
        (req.query.hmac as string);

      const secret =
        process.env.PAYMOB_HMAC_SECRET ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        process.env.BILLING_WEBHOOK_SECRET;

      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // Verify HMAC signature in production or if secret is configured
      if (secret) {
        const isValidSignature = verifyBillingHmacSignature(rawBody, signatureHeader, secret);
        if (!isValidSignature) {
          console.warn('Billing webhook HMAC verification failed.');
          return res.status(401).json({ error: 'توقيع الـ Webhook غير صحيح.' });
        }
      }

      const body = req.body || {};
      const eventType = body.type || body.event || body.obj?.event || 'payment_success';
      const eventId = String(body.id || body.obj?.id || body.transaction_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

      const uid = body.uid || body.metadata?.uid || body.obj?.order?.merchant_order_id || body.obj?.data?.metadata?.uid;
      const planId = body.planId || body.metadata?.planId || 'monthly';
      const plan = BILLING_PLANS[planId] || BILLING_PLANS.monthly;

      if (!uid) {
        console.warn('Webhook received without uid metadata:', body);
        return res.status(400).json({ error: 'معرّف المعلم (uid) غير موجود في بيانات الدفع.' });
      }

      const dbAdmin = getDb();
      const paymentRef = dbAdmin.collection('payments').doc(eventId);
      const teacherRef = dbAdmin.collection('teachers').doc(uid);
      const auditLogRef = dbAdmin.collection('auditLogs').doc(`audit_${eventId}`);

      let isDuplicate = false;

      await dbAdmin.runTransaction(async (transaction) => {
        const paymentDoc = await transaction.get(paymentRef);
        if (paymentDoc.exists && paymentDoc.data()?.status === 'processed') {
          isDuplicate = true;
          return;
        }

        const teacherDoc = await transaction.get(teacherRef);
        const now = new Date();
        const nowIso = now.toISOString();

        if (eventType === 'payment_success' || eventType === 'TRANSACTION_SUCCESS' || eventType === 'charge.success') {
          const existingData = teacherDoc.exists ? teacherDoc.data() : null;
          const currentEnd = existingData?.subscriptionEndDate || existingData?.subscriptionExpiresAt || existingData?.trialEndDate;

          const { endDate: newEndIso } = calculateExtendedSubscriptionDates(currentEnd, plan.days, now);

          transaction.set(
            teacherRef,
            {
              subscriptionStatus: 'active',
              plan: plan.id,
              isActive: true,
              subscriptionEndDate: newEndIso,
              subscriptionExpiresAt: newEndIso,
              lastPaymentId: eventId,
              updatedAt: nowIso,
            },
            { merge: true }
          );

          transaction.set(paymentRef, {
            eventId,
            uid,
            planId: plan.id,
            amountEgp: plan.priceEgp,
            status: 'processed',
            eventType,
            processedAt: nowIso,
          });

          transaction.set(auditLogRef, {
            action: 'billing_payment_success',
            eventId,
            uid,
            planId: plan.id,
            newEndDate: newEndIso,
            timestamp: nowIso,
          });
        } else if (eventType === 'refund' || eventType === 'charge.refunded') {
          transaction.set(
            teacherRef,
            {
              subscriptionStatus: 'expired',
              isActive: false,
              updatedAt: nowIso,
            },
            { merge: true }
          );

          transaction.set(paymentRef, {
            eventId,
            uid,
            status: 'processed',
            eventType: 'refunded',
            processedAt: nowIso,
          });

          transaction.set(auditLogRef, {
            action: 'billing_payment_refunded',
            eventId,
            uid,
            timestamp: nowIso,
          });
        }
      });

      if (isDuplicate) {
        return res.status(200).json({ success: true, duplicate: true });
      }

      return res.status(200).json({ success: true, processed: true });
    } catch (err: any) {
      console.error('Error in /api/billing/webhook:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء معالجة الـ Webhook.' });
    }
  });

  return router;
}
