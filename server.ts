import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';
import { GoogleGenAI } from '@google/genai';
import { createRemindersRouter } from './src/server/remindersCron.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to robustly parse FIREBASE_SERVICE_ACCOUNT environment variable
function safeParseServiceAccount(raw: string | undefined): any {
  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  // Unwrap outer quotes if wrapped
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Handle Base64 encoded string
  if (!str.startsWith('{') && (str.startsWith('ey') || str.includes('='))) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) {
        str = decoded;
      }
    } catch (_) {}
  }

  // Extract JSON payload between first '{' and last '}' to prune trailing non-whitespace characters
  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (parsed && typeof parsed === 'object' && parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
    return null;
  }
}

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'gen-lang-client-0886550561';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const parsedServiceAccount = safeParseServiceAccount(serviceAccountRaw);

  if (parsedServiceAccount) {
    initializeApp({
      credential: cert(parsedServiceAccount),
      projectId: parsedServiceAccount.project_id || projectId,
    });
  } else if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } else {
    initializeApp({
      projectId,
    });
  }
}

const adminAuth = getAuth();

const app = express();
const PORT = 3000;

// Body parser limited to 2mb
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Shared Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Middleware: Strictly verify Firebase ID Token (no unsigned fallbacks)
async function verifyFirebaseToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح به: يرجى تسجيل الدخول أولاً.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'رمز الدخول غير صالح.' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    return res.status(401).json({ error: 'رمز الدخول غير صالح أو انتهت صلاحيته.' });
  }
}

// In-memory rate limiting map: userId -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per user

function userRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const userId = (req as any).user?.uid || req.ip || 'anonymous';
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];

  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'تم تجاوز الحد المسموح به من الطلبات، يرجى المحاولة بعد قليل.' });
  }

  recent.push(now);
  rateLimitMap.set(userId, recent);
  next();
}

// AI Assistant Endpoint for "مكتبتي" (Ask Library Sources)
app.post('/api/ai/ask', verifyFirebaseToken, userRateLimiter, async (req, res) => {
  try {
    const { question, teacherName, subject, sources } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'السؤال مطلوب.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة حالياً.',
      });
    }

    const systemInstruction = `أنت المساعد الذكي التربوي المتقدم لمنصة "سند المعلم".
مهمتك تقديم إجابات وشروح تعليمية وتدريسية فائقة الجودة للأستاذ/ة ${teacherName || 'المعلم'} في مادة (${subject || 'المادة التعليمية'}).
- إذا كانت هناك مصادر أو كتب مرفوعة من قبل المعلم، اعتمد عليها بدقة في إجابتك وأشر إلى الدروس والوحدات ذات الصلة.
- اشرح المفاهيم بأسلوب تربوي ممتع وبسيط ومناسب للطلاب، مع أمثلة تطبيقية وأسئلة تدريبية إذا لزم الأمر.
- نسق إجابتك باستخدام القوائم النقطية، العناوين الفرعية، والعلامات التوضيحية لتكون سهلة القراءة ومريحة للمعلم.`;

    let promptContext = question.trim();

    if (sources && Array.isArray(sources) && sources.length > 0) {
      const formattedSources = sources
        .map(
          (s: any, idx: number) =>
            `[المصدر ${idx + 1}: ${s.title || 'مصدر بدون عنوان'} (النوع: ${s.type || 'مستند'})]\n${s.content || ''}`
        )
        .join('\n\n---\n\n');

      promptContext = `المصادر والكتب والمناهج الدراسية المرفوعة من قبل المعلم:
${formattedSources}

===============================
سؤال المعلم:
${question}

يرجى الإجابة بدقة مع الاستناد المباشر للمصادر والمناهج المرفوعة أعلاه ومساعدة المعلم في تقديم أفضل شرح لطلابه.`;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptContext,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text || 'لم يتم استلام نص من نموذج الذكاء الاصطناعي.';
    return res.json({ answer });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: 'حدث خطأ أثناء معالجة السؤال بواسطة الذكاء الاصطناعي.',
    });
  }
});

function parseExpiryDateServer(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Helper to verify teacher active subscription via Admin Firestore
async function checkTeacherSubscription(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const dbAdmin = getAdminFirestore();
    const teacherDoc = await dbAdmin.collection('teachers').doc(uid).get();
    if (!teacherDoc.exists) return true; // Default allow if teacher document is still creating
    const data = teacherDoc.data();
    if (!data) return true;

    // Admin role override
    if (data.role === 'admin') return true;

    // Explicitly deactivated check
    if (data.isActive === false) return false;

    // Check expiration date
    const effectiveExpiry = data.subscriptionEndDate || data.subscriptionExpiresAt || data.trialEndDate;
    if (effectiveExpiry) {
      const expiryDate = parseExpiryDateServer(effectiveExpiry);
      if (expiryDate) {
        return expiryDate.getTime() > Date.now();
      }
    }

    // Fallback to subscription status if no explicit expiration date is set
    if (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trial') {
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error verifying teacher subscription in server:', err);
    // Fallback to allow signed in teacher if server verification fails transiently
    return true;
  }
}

// AI Audio Transcription Endpoint
app.post('/api/ai/transcribe', verifyFirebaseToken, userRateLimiter, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'غير مصرح به: يلزم تسجيل الدخول.' });
    }

    const isSubActive = await checkTeacherSubscription(uid);
    if (!isSubActive) {
      return res.status(403).json({
        error: 'اشتراكك غير ساري أو انتهت صلاحيته. يرجى الترقية لتفعيل ميزة الإدخال الصوتي.',
      });
    }

    const { audioBase64, mimeType } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'البيانات الصوتية مطلوبة.' });
    }

    // Limit maximum audio payload size strictly to 2MB (2 * 1024 * 1024 bytes)
    const approxByteSize = Math.floor((audioBase64.length * 3) / 4);
    if (approxByteSize > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم المقطع الصوتي كبير جداً. الحد الأقصى المسموح به 2 ميجابايت.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'خدمة الذكاء الاصطناعي غير مهيأة.' });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          audioPart,
          {
            text: 'قم بتفريغ الكلمات والعبارات في هذا التسجيل الصوتي بدقة إلى نص عربي فقط بدون أي شرح أو تعليق أو علامات إضافية.',
          },
        ],
      },
    });

    const text = response.text?.trim() || '';
    return res.json({ text });
  } catch (error) {
    console.error('Gemini Audio Transcribe Error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء تفريغ المقطع الصوتي.' });
  }
});

// AI Assistant Chat Endpoint
app.post('/api/ai/assistant', verifyFirebaseToken, userRateLimiter, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'غير مصرح به: يلزم تسجيل الدخول.' });
    }

    const isSubActive = await checkTeacherSubscription(uid);
    if (!isSubActive) {
      return res.status(403).json({
        error: 'اشتراكك غير ساري أو انتهت صلاحيته. يرجى الترقية لتفعيل المساعد الذكي.',
      });
    }

    const { message, messagesHistory, summary } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'الرسالة مطلوبة.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'الرسالة طويلة جداً. الحد الأقصى 2000 حرف.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'خدمة الذكاء الاصطناعي غير مهيأة حالياً.' });
    }

    const systemInstruction = `أنت المساعد الذكي التربوي لمنصة "سند المعلم". تساعد المعلم في تنظيم جدول دراسته ومتابعة طلابه، واقتراح خطط الدروس والأسئلة والتمارين، وإعداد تقارير ملخصة لأولياء الأمور. اعتمد فقط على المعلومات والمؤشرات المتاحة في الملخص المرفق لإجابة التساؤلات الخاصة بالطلاب والجدول. إذا لم تتوفر المعلومة في الملخص وضح ذلك للمعلم بأدب ولا تبتكر بيانات غير موجودة.`;

    let formattedContext = '';
    if (summary && typeof summary === 'object') {
      formattedContext = `ملخص بيانات المعلم والجدول الحالي:
- اسم المعلم: ${summary.teacherName || 'غير محدد'}
- المادة الدراسية: ${summary.subject || 'غير محددة'}
- عدد الطلاب النشطين: ${summary.activeStudentsCount || 0}
- أسماء الطلاب: ${Array.isArray(summary.studentNames) ? summary.studentNames.join('، ') : 'لا يوجد'}
- حصص اليوم: ${Array.isArray(summary.todayClasses) && summary.todayClasses.length > 0 ? summary.todayClasses.join(' | ') : 'لا توجد حصص اليوم'}
- حصص الغد: ${Array.isArray(summary.tomorrowClasses) && summary.tomorrowClasses.length > 0 ? summary.tomorrowClasses.join(' | ') : 'لا توجد حصص غداً'}
- عدد الحصص المنجزة غير المحاسبة (المعلقة): ${summary.unsettledLessonsCount || 0}
===============================`;
    }

    // Include recent 10 messages history if available, truncating each text to 2000 chars
    let historyText = '';
    if (Array.isArray(messagesHistory) && messagesHistory.length > 0) {
      const recent = messagesHistory.slice(-10);
      historyText =
        'سجل المحادثة السابقة:\n' +
        recent
          .map((m: any) => {
            const roleStr = m.role === 'user' ? 'المعلم' : 'المساعد';
            const textStr = typeof m.text === 'string' ? m.text.slice(0, 2000) : '';
            return `${roleStr}: ${textStr}`;
          })
          .join('\n') +
        '\n===============================\n';
    }

    const fullPrompt = `${formattedContext}\n${historyText}سؤال المعلم الحالي:\n${message.slice(0, 2000).trim()}`;

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text || 'لم أتمكن من الحصول على إجابة من نموذج الذكاء الاصطناعي.';
    return res.json({ answer });
  } catch (error) {
    console.error('Gemini Assistant API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء معالجة طلبك بواسطة المساعد الذكي.' });
  }
});

// Helper to get Admin Firestore DB
function getAdminDb() {
  const dbId =
    process.env.VITE_FIREBASE_DATABASE_ID && process.env.VITE_FIREBASE_DATABASE_ID !== '(default)'
      ? process.env.VITE_FIREBASE_DATABASE_ID.trim()
      : undefined;

  const appAdmin = getApps()[0];
  return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
}

// Helper to calculate timezone-aware date & time parts using Intl.DateTimeFormat
function getTimezoneNowParts(tz = 'Africa/Cairo') {
  const now = new Date();
  const timeZone = tz || 'Africa/Cairo';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const weekdayStr = getPart('weekday');
    const hour = (parseInt(getPart('hour'), 10) || 0) % 24;
    const minute = (parseInt(getPart('minute'), 10) || 0) % 60;

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const currentDayOfWeek = weekdayMap[weekdayStr] ?? now.getDay();
    const todayStr = `${year}-${month}-${day}`;
    const currentTotalMinutes = hour * 60 + minute;

    return {
      todayStr,
      currentDayOfWeek,
      hour,
      minute,
      currentTotalMinutes,
    };
  } catch (err) {
    console.warn(`Fallback for invalid timezone "${tz}":`, err);
    const todayStr = new Intl.DateTimeFormat('en-CA').format(now);
    const currentDayOfWeek = now.getDay();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    return {
      todayStr,
      currentDayOfWeek,
      hour: now.getHours(),
      minute: now.getMinutes(),
      currentTotalMinutes,
    };
  }
}

// Cron Job Web Push Notification Endpoint (Protected by CRON_SECRET)
app.get('/api/reminders/cron', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح به: رمز CRON_SECRET غير معرّف أو الترويسة غير صحيحة.' });
    }

    const token = authHeader.substring(7).trim();
    if (token !== cronSecret.trim()) {
      return res.status(401).json({ error: 'غير مصرح به: رمز CRON_SECRET غير متطابق.' });
    }

    const dbAdmin = getAdminDb();
    const messagingAdmin = getAdminMessaging(getApps()[0]);

    // Optimize reads: Query fcmTokens collectionGroup to find only teachers who have active tokens
    const fcmGroupSnap = await dbAdmin.collectionGroup('fcmTokens').get();

    // Map: teacherId -> { tokens: string[], tokenDocPaths: Map<string, string> }
    const teacherTokensMap = new Map<string, { tokens: string[]; tokenDocPaths: Map<string, string> }>();

    fcmGroupSnap.forEach((docSnap) => {
      const parentTeacherDoc = docSnap.ref.parent.parent;
      if (!parentTeacherDoc) return;
      const teacherId = parentTeacherDoc.id;
      const tokenData = docSnap.data();
      const tokenVal = tokenData?.token || docSnap.id;
      if (!tokenVal) return;

      if (!teacherTokensMap.has(teacherId)) {
        teacherTokensMap.set(teacherId, { tokens: [], tokenDocPaths: new Map() });
      }
      const entry = teacherTokensMap.get(teacherId)!;
      if (!entry.tokens.includes(tokenVal)) {
        entry.tokens.push(tokenVal);
      }
      entry.tokenDocPaths.set(tokenVal, docSnap.ref.path);
    });

    let teachersChecked = 0;
    let notificationsSent = 0;

    for (const [teacherId, entry] of teacherTokensMap.entries()) {
      const teacherDoc = await dbAdmin.collection('teachers').doc(teacherId).get();
      if (!teacherDoc.exists) continue;
      const teacherData = teacherDoc.data();
      if (!teacherData) continue;

      // Ignore teacher if subscription is actually expired (compare subscriptionExpiresAt against current time)
      let isExpired = false;
      if (teacherData.subscriptionExpiresAt) {
        const expTime = new Date(teacherData.subscriptionExpiresAt).getTime();
        if (isNaN(expTime) || expTime <= Date.now()) {
          isExpired = true;
        }
      } else if (teacherData.subscriptionStatus === 'expired') {
        isExpired = true;
      }

      if (isExpired) continue;

      teachersChecked++;

      // Use teacher timezone (defaulting to Africa/Cairo)
      const tz = teacherData.timezone || 'Africa/Cairo';
      const { todayStr, currentDayOfWeek, currentTotalMinutes } = getTimezoneNowParts(tz);

      const minutesBefore = Number(teacherData.reminderMinutesBefore) || 15;
      const fcmTokens = entry.tokens;

      if (fcmTokens.length === 0) continue;

      // Optimize reads: Query ONLY today's schedule slots (where dayOfWeek == currentDayOfWeek)
      const schedulesSnap = await dbAdmin
        .collection('teachers')
        .doc(teacherId)
        .collection('schedules')
        .where('dayOfWeek', '==', currentDayOfWeek)
        .get();

      for (const schedDoc of schedulesSnap.docs) {
        const slot = schedDoc.data();
        if (!slot || !slot.time || !slot.time.includes(':')) {
          continue;
        }

        const [slotHour, slotMin] = slot.time.split(':').map(Number);
        const slotTotalMinutes = slotHour * 60 + slotMin;
        const diffMinutes = slotTotalMinutes - currentTotalMinutes;

        // Condition: diffMinutes is between minutesBefore - 1 and minutesBefore (inclusive)
        const isInWindow = diffMinutes >= minutesBefore - 1 && diffMinutes <= minutesBefore;
        if (!isInWindow) continue;

        const reminderId = `sent_${teacherId}_${schedDoc.id}_${todayStr}_${slot.time.replace(':', '')}`;
        const sentRef = dbAdmin
          .collection('teachers')
          .doc(teacherId)
          .collection('sentReminders')
          .doc(reminderId);

        const sentDoc = await sentRef.get();
        if (sentDoc.exists) {
          continue;
        }

        const title = '⏰ تذكير موعد الحصة القادمة';
        const body = `أستاذ/ـة ${teacherData.name || 'المعلم'}، لديك حصة قادمة مع الطالب (${slot.studentName || 'طالب'}) في تمام الساعة ${slot.time}.`;

        try {
          const sendResponse = await messagingAdmin.sendEachForMulticast({
            tokens: fcmTokens,
            notification: {
              title,
              body,
            },
            data: {
              scheduleId: schedDoc.id,
              studentName: slot.studentName || '',
              time: slot.time || '',
              tag: 'class-reminder',
            },
            webpush: {
              notification: {
                title,
                body,
                icon: '/pwa-192x192.png',
                badge: '/favicon.ico',
              },
              fcmOptions: {
                link: '/',
              },
            },
          });

          await sentRef.set({
            scheduleId: schedDoc.id,
            teacherId,
            day: todayStr,
            sentAt: new Date().toISOString(),
          });

          notificationsSent += sendResponse.successCount;

          // Delete bad tokens: Find and delete the exact matching token document
          sendResponse.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error) {
              const errCode = resp.error.code;
              if (
                errCode === 'messaging/invalid-registration-token' ||
                errCode === 'messaging/registration-token-not-registered'
              ) {
                const badToken = fcmTokens[idx];
                if (badToken) {
                  const docPath = entry.tokenDocPaths.get(badToken);
                  if (docPath) {
                    dbAdmin.doc(docPath).delete().catch(() => {});
                  }
                  // Delete documents matching token field or document ID in both users and teachers collections
                  dbAdmin
                    .collection('users')
                    .doc(teacherId)
                    .collection('fcmTokens')
                    .where('token', '==', badToken)
                    .get()
                    .then((snap) => snap.forEach((d) => d.ref.delete().catch(() => {})))
                    .catch(() => {});
                  dbAdmin
                    .collection('users')
                    .doc(teacherId)
                    .collection('fcmTokens')
                    .doc(badToken)
                    .delete()
                    .catch(() => {});

                  dbAdmin
                    .collection('teachers')
                    .doc(teacherId)
                    .collection('fcmTokens')
                    .where('token', '==', badToken)
                    .get()
                    .then((snap) => snap.forEach((d) => d.ref.delete().catch(() => {})))
                    .catch(() => {});
                  dbAdmin
                    .collection('teachers')
                    .doc(teacherId)
                    .collection('fcmTokens')
                    .doc(badToken)
                    .delete()
                    .catch(() => {});
                }
              }
            }
          });
        } catch (fcmErr) {
          console.error(`FCM send error for teacher ${teacherId}:`, fcmErr);
        }
      }
    }

    return res.json({
      success: true,
      teachersChecked,
      notificationsSent,
    });
  } catch (err: any) {
    console.error('Error in GET /api/reminders/cron:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء تشغيل تذكيرات الـ Cron.' });
  }
});

// Automated 15-Minute Class Reminders & WhatsApp/Notifications API Route (Protected)
app.use('/api/reminders', verifyFirebaseToken, userRateLimiter, createRemindersRouter());

// Local Server Runner (Vercel Serverless executes app directly via /api/index.ts)
if (!process.env.VERCEL) {
  async function startServer() {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  startServer();
}

export default app;
