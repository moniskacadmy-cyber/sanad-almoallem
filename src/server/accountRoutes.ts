import { Router, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { hashNormalizedEmail } from './billing.js';
import { resolveDatabaseId, incrementRedisCounter } from '../../server.js';

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'mailinator.com', '10minutemail.com', 'dispostable.com',
  'guerrillamail.com', 'trashmail.com', 'yopmail.com', 'fakeinbox.com',
  'getairmail.com', 'throwawaymail.com', 'sharklasers.com', 'yopmail.net',
  'yopmail.fr', 'tempail.com', 'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.block',
  'temp-mail.org', 'tempmail.net', 'mailnesia.com', 'crazymailing.com',
  'mohmal.com', 'emailondeck.com', 'maildrop.cc', 'nada.ltd', 'getnada.com',
  'burnermail.io', 'secmail.pro', '10minutemail.net', 'tempmail.dev', 'guerrillamailblock.com'
]);

export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length < 2) return false;
  const domain = parts[parts.length - 1].trim();
  if (!domain) return false;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  for (const disposableDomain of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith('.' + disposableDomain)) return true;
  }
  return false;
}

// In-memory fallback IP rate limiter for account creation attempts per IP
const accountInitIpMemoryMap = new Map<string, number[]>();
const ACCOUNT_INIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ACCOUNT_INITS_PER_IP = 5; // Max 5 account init attempts per IP per hour

export function checkAndIncrementAccountInitIpMemory(ip: string): boolean {
  const now = Date.now();
  const timestamps = accountInitIpMemoryMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < ACCOUNT_INIT_WINDOW_MS);
  if (recent.length >= MAX_ACCOUNT_INITS_PER_IP) {
    return false; // Exceeded limit
  }
  recent.push(now);
  accountInitIpMemoryMap.set(ip, recent);
  return true; // Allowed
}

export function clearAccountInitIpMemory(): void {
  accountInitIpMemoryMap.clear();
}

export function createAccountRouter() {
  const router = Router();

  function getDb() {
    const dbId = resolveDatabaseId();
    const appAdmin = getApps()[0];
    return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
  }

  router.post('/init', async (req: Request, res: Response) => {
    try {
      // 1. IP Rate Limiting via Upstash Redis (with in-memory fallback)
      const rawIp = (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString();
      const clientIp = rawIp.split(',')[0].trim();

      const redisResult = await incrementRedisCounter(
        `ratelimit:account_init:${clientIp}`,
        3600,
        MAX_ACCOUNT_INITS_PER_IP
      );

      if (redisResult.limited) {
        return res.status(429).json({
          error: 'تم تجاوز الحد المسموح لتسجيل الحسابات من هذا العنوان (IP). يرجى المحاولة لاحقاً.',
        });
      }

      if (redisResult.unavailable) {
        const allowed = checkAndIncrementAccountInitIpMemory(clientIp);
        if (!allowed) {
          return res.status(429).json({
            error: 'تم تجاوز الحد المسموح لتسجيل الحسابات من هذا العنوان (IP). يرجى المحاولة لاحقاً.',
          });
        }
      }

      // 2. Authentication & Email Validation
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول لإنشاء الحساب.' });
      }

      const email = user.email || req.body.email || '';
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'بريد إلكتروني صالح وموثق مطلوب لتفعيل الحساب.' });
      }

      if (isDisposableEmail(email)) {
        return res.status(400).json({
          error: 'عذراً، لا يُسمح بالتسجيل باستخدام بريد إلكتروني مؤقت. يرجى استخدام بريد إلكتروني حقيقي ودائم.',
        });
      }

      const { name, whatsapp, subject, timezone } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const emailHash = hashNormalizedEmail(normalizedEmail);

      const dbAdmin = getDb();
      const teacherRef = dbAdmin.collection('teachers').doc(user.uid);
      const trialUsedRef = dbAdmin.collection('trialsUsed').doc(emailHash);

      let responseProfile: any = null;

      await dbAdmin.runTransaction(async (transaction) => {
        const teacherDoc = await transaction.get(teacherRef);
        const trialUsedDoc = await transaction.get(trialUsedRef);

        const now = new Date();
        const nowIso = now.toISOString();

        if (teacherDoc.exists) {
          // Profile already exists, return current profile
          responseProfile = { id: user.uid, ...teacherDoc.data() };
          return;
        }

        const isTrialAlreadyUsed = trialUsedDoc.exists;

        let trialStartDate: string;
        let trialEndDate: string;
        let subscriptionStatus: 'trial' | 'expired';
        let isActive: boolean;

        if (isTrialAlreadyUsed) {
          // Trial already consumed by this email in the past
          trialStartDate = nowIso;
          trialEndDate = nowIso;
          subscriptionStatus = 'expired';
          isActive = false;
        } else {
          // Grant server-computed 7-day trial
          const trialEndMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
          const trialEnd = new Date(trialEndMs);
          trialStartDate = nowIso;
          trialEndDate = trialEnd.toISOString();
          subscriptionStatus = 'trial';
          isActive = true;

          // Record trial consumption in trialsUsed collection (server-only)
          transaction.set(trialUsedRef, {
            emailHash,
            firstTeacherUid: user.uid,
            usedAt: nowIso,
          });
        }

        const newProfileData = {
          id: user.uid,
          name: (typeof name === 'string' && name.trim()) || user.name || normalizedEmail.split('@')[0] || 'المعلم',
          email: normalizedEmail,
          whatsapp: (typeof whatsapp === 'string' && whatsapp.trim()) || '',
          subject: (typeof subject === 'string' && subject.trim()) || 'عام',
          role: 'teacher',
          isActive,
          subscriptionStatus,
          plan: 'monthly',
          trialStartDate,
          trialEndDate,
          subscriptionEndDate: trialEndDate,
          subscriptionExpiresAt: trialEndDate,
          timezone: (typeof timezone === 'string' && timezone.trim()) || 'Africa/Cairo',
          remindersEnabled: true,
          teacherNotificationsEnabled: true,
          reminderMinutesBefore: 15,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        transaction.set(teacherRef, newProfileData);
        responseProfile = newProfileData;
      });

      return res.status(200).json({
        success: true,
        profile: responseProfile,
      });
    } catch (err: any) {
      console.error('Error in /api/account/init:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تهيئة حساب المعلم.' });
    }
  });

  return router;
}
