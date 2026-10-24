import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { createRemindersRouter, sendWhatsAppReminderTemplate } from './src/server/remindersCron.js';
import { createSubscriptionGuard, evaluateSubscription, type TeacherSubscriptionData } from './src/server/subscriptionAccess.js';
import {
  buildAgendaMessage,
  buildClassReminderMessage,
  dueForReminder,
  getGroupAgenda,
  getIndividualAgenda,
  isInMorningWindow,
  isMutedByDnd,
  timeToMinutes,
  type PushMessage,
} from './src/server/agenda.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to robustly parse FIREBASE_SERVICE_ACCOUNT environment variable
function safeParseServiceAccount(raw: string | undefined): any {
  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Normalize repeated JSON-stringification while preserving private-key newlines.
  const newlinePlaceholder = '__FIREBASE_ESCAPED_NEWLINE__';
  str = str.replace(/\\+n/g, newlinePlaceholder);
  for (let pass = 0; pass < 3; pass += 1) {
    str = str.replace(/\\+"/g, '"').replace(/^\\+/, '').trim();
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }
  }
  str = str.replace(/\\+/g, '');
  str = str.replace(new RegExp(newlinePlaceholder, 'g'), '\\\\n').trim();

  // Some dashboard pastes omit the outer object braces.
  const typeIndex = str.indexOf('"type"');
  if (!str.startsWith('{') && typeIndex >= 0) {
    str = `{${str.slice(typeIndex)}`;
  }

  // Handle base64-encoded service-account JSON.
  if (!str.startsWith('{') && /^(?:ey|eyJ)/.test(str)) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) str = decoded;
    } catch (_) {}
  }

  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (parsed && typeof parsed === 'object' && parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    if (parsed?.type !== 'service_account' || !parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
      throw new Error('Firebase service account fields are incomplete');
    }
    return parsed;
  } catch (err) {
    console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
    return null;
  }
}

// Public (non-secret) Firebase web config shipped with the project. Used only as a
// fallback so that server and client resolve the SAME project and Firestore database.
let fallbackConfig: any = {};
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    fallbackConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch {
  // ignore fallback read error
}

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    fallbackConfig.projectId;
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
    if (!projectId) {
      throw new Error(
        'Firebase project is not configured: set FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID).'
      );
    }
    initializeApp({
      projectId,
    });
  }
}

const adminAuth = getAuth();

const app = express();
const PORT = 3000;

// Body parser: 4.5mb limit for /api/ai/transcribe and 2mb limit for all other routes
app.use((req, res, next) => {
  if (req.path === '/api/ai/transcribe') {
    return express.json({ limit: '4.5mb' })(req, res, next);
  }
  return express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Set Cross-Origin-Opener-Policy to allow Firebase Auth popups without browser cancellation blocking
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Shared Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Gemini can temporarily return 503/UNAVAILABLE during provider demand spikes.
// Retry up to 2 times with backoff for transient errors.
async function generateGeminiContentWithRetry(request: Parameters<typeof ai.models.generateContent>[0]) {
  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.status ?? error?.code ?? error?.error?.code);
      const message = String(error?.message ?? '').toLowerCase();
      // 429 can mean a hard project quota exhaustion (not a transient overload).
      // Retrying it would only waste quota/time, so only retry 5xx/provider-unavailable errors.
      const transient = status === 500 || status === 502 || status === 503 || status === 504 || message.includes('unavailable') || message.includes('high demand');
      if (!transient || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}


// Free Gemini/Gemma fallback: when the primary Gemini model exhausts quota or is
// temporarily unavailable, try Gemma 4 using the same API key.
async function generateGeminiTextWithFreeFallback(
  request: Parameters<typeof ai.models.generateContent>[0],
) {
  try {
    const response = await generateGeminiContentWithRetry(request);
    return response;
  } catch (error: any) {
    const status = Number(error?.status ?? error?.code ?? error?.error?.code);
    const message = String(error?.message ?? '').toLowerCase();
    const fallbackEligible =
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      message.includes('unavailable') ||
      message.includes('high demand');

    if (!fallbackEligible) throw error;

    const fallbackModel = process.env.GEMINI_FREE_FALLBACK_MODEL || 'gemma-4-26b-a4b-it';
    console.warn('Primary Gemini model unavailable/quota exhausted; trying free Gemma fallback.', fallbackModel);

    return await ai.models.generateContent({
      ...request,
      model: fallbackModel,
    });
  }
}

async function* streamGeminiTextWithFreeFallback(request: Parameters<typeof ai.models.generateContentStream>[0]) {
  let stream;
  try { stream = await ai.models.generateContentStream(request); }
  catch (error: any) {
    const status = Number(error?.status ?? error?.code ?? error?.error?.code);
    const message = String(error?.message ?? '').toLowerCase();
    const eligible = status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || message.includes('unavailable') || message.includes('high demand');
    if (!eligible) throw error;
    const fallbackModel = process.env.GEMINI_FREE_FALLBACK_MODEL || 'gemma-4-26b-a4b-it';
    console.warn('Primary Gemini stream unavailable/quota exhausted; trying free Gemma fallback.', fallbackModel);
    stream = await ai.models.generateContentStream({ ...request, model: fallbackModel });
  }
  for await (const chunk of stream) { const chunkText = chunk.text || ''; if (chunkText) yield chunkText; }
}

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
    console.error('Firebase ID token verification failed:', (error as { code?: string })?.code || 'unknown');
    return res.status(401).json({ error: 'رمز الدخول غير صالح أو انتهت صلاحيته.' });
  }
}

type RedisLimitResult = { limited: boolean; unavailable: boolean };

export async function incrementRedisCounter(
  key: string,
  windowSeconds: number,
  maxRequests: number
): Promise<RedisLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return { limited: false, unavailable: true };

  try {
    const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
    const windowKey = `${key}:${windowIndex}`;

    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', windowKey],
        ['EXPIRE', windowKey, windowSeconds * 2],
      ]),
    });

    if (!response.ok) return { limited: false, unavailable: true };
    const data = await response.json();
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) return { limited: false, unavailable: true };
    return { limited: count > maxRequests, unavailable: false };
  } catch (err) {
    console.warn('Upstash Redis limiter unavailable:', err instanceof Error ? err.message : 'unknown');
    return { limited: false, unavailable: true };
  }
}

// In-memory rate limiting map: userId -> timestamps[] (used as instance fallback)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

// In-memory buckets for AI limits fallback outside Vercel
const memoryAiBuckets = new Map<string, number[]>();

export function checkAndIncrementMemoryAiBucket(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const timestamps = memoryAiBuckets.get(key) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    return false; // rejected
  }
  recent.push(now);
  memoryAiBuckets.set(key, recent);
  return true; // allowed
}

async function userRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const userId = (req as any).user?.uid || req.ip || 'anonymous';
  const result = await incrementRedisCounter(`ratelimit:generic:${userId}`, 60, MAX_REQUESTS_PER_WINDOW);

  if (result.limited) {
    return res.status(429).json({ error: 'تم تجاوز الحد المسموح به من الطلبات، يرجى المحاولة بعد دقيقة.' });
  }

  if (result.unavailable) {
    if (process.env.VERCEL) {
      return res.status(503).json({ error: 'خدمة تحديد معدل الطلبات غير متاحة مؤقتاً. حاول بعد قليل.' });
    }

    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({ error: 'تم تجاوز الحد المسموح به من الطلبات، يرجى المحاولة بعد قليل.' });
    }
    recent.push(now);
    rateLimitMap.set(userId, recent);
  }

  next();
}

export const AI_LIMITS = {
  ask: { perMinute: 10, daily: 100 },
  assistant: { perMinute: 15, daily: 100 },
  transcribe: { perMinute: 5, daily: 50 },
} as const;

export async function aiRateLimiter(
  routeName: keyof typeof AI_LIMITS,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const userId = (req as any).user?.uid;
  if (!userId) return res.status(401).json({ error: 'غير مصرح به.' });

  const limits = AI_LIMITS[routeName];
  const totalDailyLimit = Number(process.env.AI_DAILY_REQUESTS || 100);

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const hasRedis = Boolean(url && token);

  if (!hasRedis && process.env.VERCEL) {
    return res.status(503).json({ error: 'حماية الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل.' });
  }

  if (hasRedis) {
    // Check minute limit first
    const minute = await incrementRedisCounter(`ai:${routeName}:minute:${userId}`, 60, limits.perMinute);
    if (minute.unavailable) {
      if (process.env.VERCEL) {
        return res.status(503).json({ error: 'حماية الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل.' });
      }
    }
    if (minute.limited) {
      return res.status(429).json({ error: 'تم تجاوز الحد المسموح به من طلبات الذكاء الاصطناعي خلال الدقيقة.' });
    }

    // Check route daily limit ONLY if minute passed
    const day = await incrementRedisCounter(`ai:${routeName}:day:${userId}`, 86400, limits.daily);
    if (day.unavailable) {
      if (process.env.VERCEL) {
        return res.status(503).json({ error: 'حماية الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل.' });
      }
    }
    if (day.limited) {
      return res.status(429).json({ error: 'تم تجاوز الحد اليومي لهذه الخدمة من الذكاء الاصطناعي. حاول غداً.' });
    }

    // Check total daily limit ONLY if route daily passed
    const totalDay = await incrementRedisCounter(`ai:total-day:${userId}`, 86400, totalDailyLimit);
    if (totalDay.unavailable) {
      if (process.env.VERCEL) {
        return res.status(503).json({ error: 'حماية الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل.' });
      }
    }
    if (totalDay.limited) {
      return res.status(429).json({ error: 'تم تجاوز إجمالي الحد اليومي للذكاء الاصطناعي. حاول غداً.' });
    }
  } else {
    // In-memory fallback outside Vercel
    const minuteAllowed = checkAndIncrementMemoryAiBucket(`ai:${routeName}:minute:${userId}`, 60 * 1000, limits.perMinute);
    if (!minuteAllowed) {
      return res.status(429).json({ error: 'تم تجاوز الحد المسموح به من طلبات الذكاء الاصطناعي خلال الدقيقة.' });
    }

    const dayAllowed = checkAndIncrementMemoryAiBucket(`ai:${routeName}:day:${userId}`, 24 * 60 * 60 * 1000, limits.daily);
    if (!dayAllowed) {
      return res.status(429).json({ error: 'تم تجاوز الحد اليومي لهذه الخدمة من الذكاء الاصطناعي. حاول غداً.' });
    }

    const totalDayAllowed = checkAndIncrementMemoryAiBucket(`ai:total-day:${userId}`, 24 * 60 * 60 * 1000, totalDailyLimit);
    if (!totalDayAllowed) {
      return res.status(429).json({ error: 'تم تجاوز إجمالي الحد اليومي للذكاء الاصطناعي. حاول غداً.' });
    }
  }

  next();
}

// Helper to get Admin Firestore DB.
// MUST resolve the same database as the client (src/firebase.ts): VITE_FIREBASE_DATABASE_ID or FIREBASE_DATABASE_ID. '(default)' / empty -> default DB.
export function resolveDatabaseId(): string | undefined {
  const currentProjectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    fallbackConfig.projectId;
  const isAiStudioProject =
    Boolean(fallbackConfig.projectId) && currentProjectId === fallbackConfig.projectId;

  const explicit =
    process.env.VITE_FIREBASE_DATABASE_ID?.trim() ||
    process.env.FIREBASE_DATABASE_ID?.trim();

  if (explicit && explicit !== '(default)') return explicit;
  if (!explicit && isAiStudioProject && fallbackConfig.firestoreDatabaseId && fallbackConfig.firestoreDatabaseId !== '(default)') {
    return fallbackConfig.firestoreDatabaseId;
  }
  return undefined;
}

function getAdminDb() {
  const dbId = resolveDatabaseId();
  const appAdmin = getApps()[0];
  return dbId ? getAdminFirestore(appAdmin, dbId) : getAdminFirestore(appAdmin);
}

// Fail-closed subscription guard for every paid feature. The uid comes ONLY from the
// verified ID token (req.user set by verifyFirebaseToken), never from the request body.
// Admin policy follows security_spec.md / firestore.rules: admins/{uid} document exists.
const requireActiveSubscription = createSubscriptionGuard({
  async readTeacher(uid) {
    const snap = await getAdminDb().collection('teachers').doc(uid).get();
    return snap.exists ? (snap.data() as TeacherSubscriptionData) : null;
  },
  async isAdmin(uid) {
    const snap = await getAdminDb().collection('admins').doc(uid).get();
    return snap.exists;
  },
  logError(message, err) {
    const e = err as { code?: string | number; name?: string; message?: string };
    // Log only non-secret diagnostic metadata so Firestore failures can be
    // diagnosed in Vercel without exposing credentials or document contents.
    console.error(
      message,
      JSON.stringify({
        code: e?.code ?? null,
        name: e?.name ?? null,
        message: e?.message ?? null,
      })
    );
  },
});

// Simple LRU/TTL Cache for AI questions to reduce latency & API costs
const aiAskCache = new Map<string, { answer: string; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// AI Assistant Endpoint for "مكتبتي" (Ask Library Sources with Streaming SSE support)
app.post('/api/ai/ask', verifyFirebaseToken, (req, res, next) => aiRateLimiter('ask', req, res, next), requireActiveSubscription, async (req, res) => {
  try {
    const { question, teacherName, subject, sources, stream = false } = req.body;
    const wantStream = stream === true || req.headers.accept?.includes('text/event-stream');

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'السؤال مطلوب.' });
    }

    if (question.length > 4000) {
      return res.status(400).json({ error: 'السؤال طويل جداً. الحد الأقصى المسموح به هو 4000 حرف.' });
    }

    if (teacherName && (typeof teacherName !== 'string' || teacherName.length > 150)) {
      return res.status(400).json({ error: 'اسم المعلم غير صالح أو يتجاوز 150 حرفاً.' });
    }

    if (subject && (typeof subject !== 'string' || subject.length > 150)) {
      return res.status(400).json({ error: 'المادة الدراسية غير صالحة أو تتجاوز 150 حرفاً.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة حالياً.',
      });
    }

    // Check Cache for identical queries
    const cacheKey = `${teacherName || ''}:${subject || ''}:${question.trim().toLowerCase()}:${sources?.length || 0}`;
    const cached = aiAskCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      if (wantStream) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ text: cached.answer })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }
      return res.json({ answer: cached.answer, cached: true });
    }

    const systemInstruction = `أنت المساعد الذكي التربوي المتقدم لمنصة "سند المعلم".
مهمتك تقديم إجابات وشروح تعليمية وتدريسية فائقة الجودة للأستاذ/ة ${teacherName || 'المعلم'} في مادة (${subject || 'المادة التعليمية'}).
- إذا كانت هناك مصادر أو كتب مرفوعة من قبل المعلم، اعتمد عليها بدقة في إجابتك وأشر إلى الدروس والوحدات ذات الصلة.
- اشرح المفاهيم بأسلوب تربوي ممتع وبسيط ومناسب للطلاب، مع أمثلة تطبيقية وأسئلة تدريبية إذا لزم الأمر.
- نسق إجابتك باستخدام القوائم النقطية، العناوين الفرعية، والعلامات التوضيحية لتكون سهلة القراءة ومريحة للمعلم.`;

    let promptContext = question.trim();

    if (sources) {
      if (!Array.isArray(sources)) {
        return res.status(400).json({ error: 'صيغة المصادر المرفقة غير صالحة.' });
      }
      if (sources.length > 20) {
        return res.status(400).json({ error: 'تم تجاوز الحد الأقصى للمصادر المرفقة (الحد الأقصى 20 مصدراً).' });
      }

      let totalSourceChars = 0;
      for (const s of sources) {
        if (!s || typeof s !== 'object') {
          return res.status(400).json({ error: 'بيانات أحد المصادر غير صالحة.' });
        }
        if (s.title && (typeof s.title !== 'string' || s.title.length > 200)) {
          return res.status(400).json({ error: 'عنوان أحد المصادر يتجاوز 200 حرف.' });
        }
        if (s.type && (typeof s.type !== 'string' || s.type.length > 50)) {
          return res.status(400).json({ error: 'نوع أحد المصادر يتجاوز 50 حرفاً.' });
        }
        if (s.content) {
          if (typeof s.content !== 'string') {
            return res.status(400).json({ error: 'محتوى أحد المصادر غير صالح.' });
          }
          if (s.content.length > 30000) {
            return res.status(400).json({ error: 'محتوى أحد المصادر طويل جداً (يتجاوز 30000 حرف).' });
          }
          totalSourceChars += s.content.length;
        }
      }

      if (totalSourceChars > 100000) {
        return res.status(400).json({ error: 'إجمالي حجم نصوص المصادر كبير جداً ويشكل عبئاً على النظام (يتجاوز 100,000 حرف).' });
      }

      // Optimize context by truncating each source to max 5000 characters for fast TTFT
      const formattedSources = sources
        .map(
          (s: any, idx: number) => {
            const truncatedContent = typeof s.content === 'string' ? s.content.slice(0, 5000) : '';
            return `[المصدر ${idx + 1}: ${s.title || 'مصدر بدون عنوان'} (النوع: ${s.type || 'مستند'})]\n${truncatedContent}`;
          }
        )
        .join('\n\n---\n\n');

      promptContext = `المصادر والكتب والمناهج الدراسية المرفوعة من قبل المعلم:
${formattedSources}

===============================
سؤال المعلم:
${question}

يرجى الإجابة بدقة مع الاستناد المباشر للمصادر والمناهج المرفوعة أعلاه ومساعدة المعلم في تقديم أفضل شرح لطلابه.`;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let fullAnswer = '';
      try {
        const streamGenerator = streamGeminiTextWithFreeFallback({
          model: modelName,
          contents: promptContext,
          config: { systemInstruction },
        });

        for await (const chunk of streamGenerator) {
          if (chunk) {
            fullAnswer += chunk;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            if (typeof (res as any).flush === 'function') (res as any).flush();
          }
        }

        if (fullAnswer) {
          aiAskCache.set(cacheKey, { answer: fullAnswer, timestamp: Date.now() });
        }

        res.write(`data: [DONE]\n\n`);
        return res.end();
      } catch (streamErr: any) {
        console.error('Streaming Gemini Error:', streamErr);
        res.write(`data: ${JSON.stringify({ error: 'حدث خطأ أثناء بث الإجابة.' })}\n\n`);
        return res.end();
      }
    } else {
      const response = await generateGeminiTextWithFreeFallback({
        model: modelName,
        contents: promptContext,
        config: { systemInstruction },
      });

      const answer = response.text || 'لم يتم استلام نص من نموذج الذكاء الاصطناعي.';
      aiAskCache.set(cacheKey, { answer, timestamp: Date.now() });
      return res.json({ answer });
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    const status = Number((error as any)?.status);
    if (status === 429) return res.status(429).json({ error: 'تم استنفاد حصة Gemini API الحالية للمشروع. يرجى تفعيل الفوترة أو الانتظار حتى تتجدد الحصة.' });
    return res.status(status === 503 ? 503 : 500).json({
      error: status === 503 ? 'خدمة الذكاء الاصطناعي مشغولة حالياً. حاول مرة أخرى بعد قليل.' : 'حدث خطأ أثناء معالجة السؤال بواسطة الذكاء الاصطناعي.',
    });
  }
});

// AI Audio Transcription Endpoint
app.post('/api/ai/transcribe', verifyFirebaseToken, (req, res, next) => aiRateLimiter('transcribe', req, res, next), requireActiveSubscription, async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    const allowedAudioMimeTypes = new Set(['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg']);
    if (mimeType && (typeof mimeType !== 'string' || !allowedAudioMimeTypes.has(mimeType))) {
      return res.status(400).json({ error: 'نوع الملف الصوتي غير مدعوم.' });
    }
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'البيانات الصوتية مطلوبة.' });
    }

    // Limit maximum audio payload size strictly to 1.5MB after base64 decoding (1.5 * 1024 * 1024 bytes)
    const approxByteSize = Math.floor((audioBase64.length * 3) / 4);
    if (approxByteSize > 1.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم المقطع الصوتي كبير جداً. الحد الأقصى المسموح به 1.5 ميجابايت (يرجى تسجيل مقطع أقصر).' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'خدمة الذكاء الاصطناعي غير مهيأة.' });
    }

    const modelName = 'gemini-3.5-transcribe';
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
    const status = Number((error as any)?.status);
    if (status === 429) return res.status(429).json({ error: 'تم استنفاد حصة Gemini API الحالية للمشروع. يرجى تفعيل الفوترة أو الانتظار حتى تتجدد الحصة.' });
    return res.status(status === 503 ? 503 : 500).json({ error: status === 503 ? 'خدمة الذكاء الاصطناعي مشغولة حالياً. حاول مرة أخرى بعد قليل.' : 'حدث خطأ أثناء تفريغ المقطع الصوتي.' });
  }
});

// AI Assistant Chat Endpoint
app.post('/api/ai/assistant', verifyFirebaseToken, (req, res, next) => aiRateLimiter('assistant', req, res, next), requireActiveSubscription, async (req, res) => {
  let streamStarted = false;
  try {
    const { message, messagesHistory, summary, model, role, customInstruction } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'الرسالة مطلوبة.' });
    if (message.length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جداً. الحد الأقصى 2000 حرف.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'خدمة الذكاء الاصطناعي غير مهيأة حالياً.' });
    
    // Model selection: gemini-4-argon for complex tasks, gemini-3.8-flash for general tasks (default), gemini-3.1-flash-lite for fast tasks
    const allowedModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const selectedModel = allowedModels.includes(model) ? model : (process.env.GEMINI_MODEL || 'gemini-3.8-flash');

    // Role-specific System Instructions
    const ROLE_INSTRUCTIONS: Record<string, string> = {
      general: 'أنت "سند" المساعد الذكي التربوي لمنصة سند المعلم. ساعد المعلم بإجابات عملية، ذكية، ومباشرة. اعتمد على سياق المعلم وطلابه ومواعيده المتاحة. إذا لم تتوفر معلومة وضح ذلك ولا تبتكر بيانات. اجعل إجابتك منسقة بنقاط واضحة.',
      lesson_planner: 'أنت خبير تربوي ومستشار تصميم مناهج وتحضير دروس لمنصة سند المعلم. دورك صياغة خطط دروس احترافية وشاملة تحتوي على: الأهداف السلوكية (معرفية، وجدانية، مهارية)، التمهيد الشيق، استراتيجيات التدريس النشط، الأنشطة والوسائل، والتقويم الختامي، مع تقسيم الوقت بدقة.',
      quiz_generator: 'أنت أخصائي قياس وتقويم تربوي وإعداد اختبارات. دورك مساعدة المعلم في توليد بنوك أسئلة وامتحانات متوازنة (اختيار من متعدد، علل، صح وخطأ، مسائل تطبيقية) متدرجة من التذكر للفهم والتطبيق، مع تزويد المعلم بنموذج إجابة كامل وسلم درجات وتوزيع النقاط.',
      parent_comms: 'أنت خبير تواصل مدرسي وعلاقات مع أولياء الأمور. دورك مساعدة المعلم في صياغة رسائل واتساب وبريد إلكتروني راقية، مهذبة، مشجعة، وواضحة جداً. تشمل: تقارير الأداء الدوري، تنبيهات الغياب والواجبات، تذكير بمواعيد الحصص والمدفوعات بلباقة مع مراعاة الحالة النفسية للطالب وولي الأمر.',
      problem_solver: 'أنت أستاذ متخصص في التفكير التحليلي وحل المسائل العلمية والرياضية والمنطقية المعقدة. دورك تقديم شروحات عميقة خطوة بخطوة لكل مسألة، وتوضيح القوانين الرياضية، وذكر الأخطاء الشائعة التي يقع فيها الطلاب، وتقديم طرق بديلة أو تحقق منطقي من النتيجة.',
    };

    const selectedRoleKey = (typeof role === 'string' && ROLE_INSTRUCTIONS[role]) ? role : 'general';
    let baseInstruction = ROLE_INSTRUCTIONS[selectedRoleKey];
    if (typeof customInstruction === 'string' && customInstruction.trim() && customInstruction.length <= 1000) {
      baseInstruction += `\nتعليمات إضافية يفضلها المعلم:\n${customInstruction.trim()}`;
    }
    const systemInstruction = baseInstruction;

    let formattedContext = '';
    if (summary && typeof summary === 'object') {
      const stringFieldLimits: Record<string, number> = { teacherName: 150, subject: 150 };
      for (const [key, max] of Object.entries(stringFieldLimits)) if (summary[key] !== undefined && (typeof summary[key] !== 'string' || summary[key].length > max)) return res.status(400).json({ error: 'بيانات الملخص غير صالحة.' });
      for (const key of ['studentNames', 'todayClasses', 'tomorrowClasses']) if (summary[key] !== undefined && (!Array.isArray(summary[key]) || summary[key].length > 50)) return res.status(400).json({ error: 'بيانات الملخص غير صالحة.' });
      const compactSummary = { teacherName: typeof summary.teacherName === 'string' ? summary.teacherName.slice(0, 150) : '', subject: typeof summary.subject === 'string' ? summary.subject.slice(0, 150) : '', activeStudentsCount: Number(summary.activeStudentsCount) || 0, studentNames: Array.isArray(summary.studentNames) ? summary.studentNames.slice(0, 30) : [], todayClasses: Array.isArray(summary.todayClasses) ? summary.todayClasses.slice(0, 12) : [], tomorrowClasses: Array.isArray(summary.tomorrowClasses) ? summary.tomorrowClasses.slice(0, 12) : [], unsettledLessonsCount: Number(summary.unsettledLessonsCount) || 0 };
      formattedContext = `ملخص بيانات المعلم والجدول الحالي:\n- اسم المعلم: ${compactSummary.teacherName || 'غير محدد'}\n- المادة الدراسية: ${compactSummary.subject || 'غير محددة'}\n- عدد الطلاب النشطين: ${compactSummary.activeStudentsCount}\n- أسماء الطلاب: ${compactSummary.studentNames.join('، ') || 'لا يوجد'}\n- حصص اليوم: ${compactSummary.todayClasses.join(' | ') || 'لا توجد'}\n- حصص الغد: ${compactSummary.tomorrowClasses.join(' | ') || 'لا توجد'}\n- الحصص المعلقة: ${compactSummary.unsettledLessonsCount}\n===============================`;
      if (formattedContext.length > 7000) return res.status(400).json({ error: 'ملخص البيانات كبير جداً.' });
    }
    let historyText = '';
    if (messagesHistory !== undefined && !Array.isArray(messagesHistory)) return res.status(400).json({ error: 'سجل المحادثة غير صالح.' });
    if (Array.isArray(messagesHistory) && messagesHistory.length > 20) return res.status(400).json({ error: 'سجل المحادثة كبير جداً.' });
    if (Array.isArray(messagesHistory) && messagesHistory.length) { const recent = messagesHistory.slice(-10); historyText = 'سجل المحادثة السابقة:\n' + recent.map((m: any) => `${m.role === 'user' ? 'المعلم' : 'المساعد'}: ${typeof m.text === 'string' ? m.text.slice(0, 1000) : ''}`).join('\n') + '\n===============================\n'; }
    const fullPrompt = `${formattedContext}\n${historyText}سؤال المعلم الحالي:\n${message.slice(0, 2000).trim()}`;
    if (fullPrompt.length > 12000) return res.status(400).json({ error: 'حجم الطلب النهائي كبير جداً.' });
    const stream = streamGeminiTextWithFreeFallback({ 
      model: selectedModel, 
      contents: fullPrompt, 
      config: { 
        systemInstruction, 
        maxOutputTokens: 1500,
        tools: [{ googleSearch: {} }]
      }
    });
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders?.(); streamStarted = true;
    for await (const chunkText of stream) res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    res.write('data: [DONE]\n\n'); return res.end();
  } catch (error) {
    console.error('Gemini Assistant API Error:', error);
    const status = Number((error as any)?.status);
    const errorMessage = status === 429 ? 'تم استنفاد حصة Gemini API الحالية للمشروع. يرجى تفعيل الفوترة أو الانتظار حتى تتجدد الحصة.' : status === 503 ? 'خدمة الذكاء الاصطناعي مشغولة حالياً. حاول مرة أخرى بعد قليل.' : 'حدث خطأ أثناء معالجة طلبك بواسطة المساعد الذكي.';
    if (streamStarted) { res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`); return res.end(); }
    return res.status(status === 429 || status === 503 ? status : 500).json({ error: errorMessage });
  }
});
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

// ---------------------------------------------------------------------------
// Push helpers shared by the group / morning / login notifications
// ---------------------------------------------------------------------------

/** Atomically claims a reminder so that only one cron tick (or request) sends it. Same rules as the individual-class claim. */
async function claimReminder(dbAdmin: any, sentRef: any, meta: Record<string, unknown>): Promise<boolean> {
  let shouldSend = false;
  try {
    await dbAdmin.runTransaction(async (transaction: any) => {
      shouldSend = false; // a retried transaction must start from a clean decision
      const currentDoc = await transaction.get(sentRef);
      const nowIso = new Date().toISOString();
      if (!currentDoc.exists) {
        transaction.set(sentRef, { ...meta, status: 'claiming', claimedAt: nowIso });
        shouldSend = true;
        return;
      }
      const data = currentDoc.data();
      if (data?.status === 'sent') return;
      if (data?.status === 'claiming') {
        const claimedAtMs = data.claimedAt ? new Date(data.claimedAt).getTime() : 0;
        if (Date.now() - claimedAtMs > 2 * 60 * 1000) {
          transaction.update(sentRef, { status: 'claiming', claimedAt: nowIso, retried: true });
          shouldSend = true;
        }
        return;
      }
      if (data?.status === 'failed') {
        transaction.update(sentRef, { status: 'claiming', claimedAt: nowIso, retriedFromFailed: true });
        shouldSend = true;
      }
    });
  } catch {
    return false;
  }
  return shouldSend;
}

/** Web Push with high urgency, so a locked / dozing phone is woken up; the message is dropped after ttlSeconds. */
async function sendPush(
  messagingAdmin: any,
  tokens: string[],
  msg: PushMessage,
  data: Record<string, string> = {},
  ttlSeconds = 3600
) {
  return messagingAdmin.sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    data: { tag: msg.tag, ...data },
    webpush: {
      headers: { Urgency: 'high', TTL: String(ttlSeconds) },
      notification: {
        title: msg.title,
        body: msg.body,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
      },
      fcmOptions: { link: '/' },
    },
  });
}

/** Deletes tokens that FCM reports as dead, so they are not retried every minute. */
function removeBadTokens(
  dbAdmin: any,
  teacherId: string,
  tokens: string[],
  tokenDocPaths: Map<string, string> | undefined,
  response: any
) {
  response.responses.forEach((resp: any, idx: number) => {
    if (resp.success || !resp.error) return;
    const code = resp.error.code;
    if (code !== 'messaging/invalid-registration-token' && code !== 'messaging/registration-token-not-registered') return;
    const bad = tokens[idx];
    if (!bad) return;
    const docPath = tokenDocPaths?.get(bad) || `teachers/${teacherId}/fcmTokens/${bad}`;
    dbAdmin.doc(docPath).delete().catch(() => {});
  });
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

      // Ignore teachers whose subscription is not currently active.
      // Keep this decision aligned with the same server-side subscription logic
      // used by paid API routes.
      if (evaluateSubscription(teacherData, new Date()) !== 'active') continue;

      if (teacherData.remindersEnabled === false || teacherData.teacherNotificationsEnabled === false) continue;

      teachersChecked++;

      // Use the teacher profile timezone, falling back to Cairo for existing accounts.
      const tz = teacherData.timezone || 'Africa/Cairo';
      const { todayStr, currentDayOfWeek, currentTotalMinutes } = getTimezoneNowParts(tz);

      const minutesBefore = Number(teacherData.reminderMinutesBefore) || 15;
      const fcmTokens = entry.tokens;

      if (fcmTokens.length === 0) continue;

      // Respect the teacher's Do-Not-Disturb setting (quiet hours / weekends / vacation).
      if (isMutedByDnd(teacherData.doNotDisturb, currentDayOfWeek, currentTotalMinutes)) continue;

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

        // Condition: diffMinutes is within the lookahead window (0 < diffMinutes <= minutesBefore)
        const isInWindow = diffMinutes > 0 && diffMinutes <= minutesBefore;
        if (!isInWindow) continue;

        const reminderId = `sent_${teacherId}_${schedDoc.id}_${todayStr}_${slot.time.replace(':', '')}`;
        const sentRef = dbAdmin
          .collection('teachers')
          .doc(teacherId)
          .collection('sentReminders')
          .doc(reminderId);

        let shouldSend = false;
        try {
          // Atomic distributed transaction claiming
          await dbAdmin.runTransaction(async (transaction) => {
            const currentDoc = await transaction.get(sentRef);
            const nowIso = new Date().toISOString();
            if (!currentDoc.exists) {
              transaction.set(sentRef, {
                status: 'claiming',
                scheduleId: schedDoc.id,
                teacherId,
                day: todayStr,
                claimedAt: nowIso,
              });
              shouldSend = true;
              return;
            }

            const currentData = currentDoc.data();
            if (currentData?.status === 'sent') {
              shouldSend = false;
              return;
            }

            if (currentData?.status === 'claiming') {
              const claimedAtMs = currentData.claimedAt ? new Date(currentData.claimedAt).getTime() : 0;
              const isStale = Date.now() - claimedAtMs > 2 * 60 * 1000;
              if (isStale) {
                transaction.update(sentRef, {
                  status: 'claiming',
                  claimedAt: nowIso,
                  retried: true,
                });
                shouldSend = true;
                return;
              }
              shouldSend = false;
              return;
            }

            if (currentData?.status === 'failed') {
              transaction.update(sentRef, {
                status: 'claiming',
                claimedAt: nowIso,
                retriedFromFailed: true,
              });
              shouldSend = true;
              return;
            }
          });
        } catch (lockError) {
          continue;
        }

        if (!shouldSend) continue;

        const title = '⏰ تذكير موعد الحصة القادمة';
        const body = `أستاذ/ـة ${teacherData.name || 'المعلم'}، لديك حصة قادمة مع الطالب (${slot.studentName || 'طالب'}) في تمام الساعة ${slot.time}.`;

        // Optional automatic WhatsApp reminder to the teacher. This uses an approved
        // WhatsApp Cloud API template because reminders are business-initiated messages.
        const whatsappResult =
          process.env.WHATSAPP_SEND_TO_TEACHER === 'false'
            ? { configured: false, sent: false, error: 'تم تعطيل إرسال واتساب للمعلم.' }
            : await sendWhatsAppReminderTemplate({
                to: teacherData.whatsapp || '',
                studentName: slot.studentName || 'طالب',
                subject: slot.subject || teacherData.subject || 'المادة',
                classTime: slot.time,
                locationOrLink: slot.locationOrLink,
              });

        if (whatsappResult.error) {
          console.warn(`WhatsApp reminder for teacher ${teacherId}: ${whatsappResult.error}`);
        }

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
              headers: { Urgency: 'high', TTL: '3600' },
              fcmOptions: {
                link: '/',
              },
            },
          });

          await sentRef.set({
            status: 'sent',
            scheduleId: schedDoc.id,
            teacherId,
            day: todayStr,
            sentAt: new Date().toISOString(),
            fcmSuccessCount: sendResponse.successCount,
            whatsappConfigured: whatsappResult.configured,
            whatsappSent: whatsappResult.sent,
            whatsappError: whatsappResult.error || null,
          });

          notificationsSent += sendResponse.successCount;

          // Delete bad tokens: Find and delete the exact matching token document in teachers/{uid}/fcmTokens
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
        } catch (fcmErr: any) {
          console.error(`FCM send error for teacher ${teacherId}:`, fcmErr);
          await sentRef.set({
            status: 'failed',
            error: fcmErr instanceof Error ? fcmErr.message : String(fcmErr),
            scheduleId: schedDoc.id,
            teacherId,
            day: todayStr,
            failedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      // ---- Group class reminders + morning summary ----
      try {
        const groupsSnap = await dbAdmin.collection('teachers').doc(teacherId).collection('groups').get();
        const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const groupItems = getGroupAgenda(groups, currentDayOfWeek);
        const sentCol = dbAdmin.collection('teachers').doc(teacherId).collection('sentReminders');

        for (const item of dueForReminder(groupItems, currentTotalMinutes, minutesBefore)) {
          const groupSentRef = sentCol.doc(`sent_${teacherId}_${item.id}_${todayStr}`);
          if (!(await claimReminder(dbAdmin, groupSentRef, { teacherId, groupSlotId: item.id, day: todayStr }))) continue;
          try {
            const msg = buildClassReminderMessage(teacherData.name, item);
            const resp = await sendPush(messagingAdmin, fcmTokens, msg, { groupSlotId: item.id, time: item.time }, 3600);
            await groupSentRef.set({
              status: 'sent',
              teacherId,
              groupSlotId: item.id,
              day: todayStr,
              sentAt: new Date().toISOString(),
              fcmSuccessCount: resp.successCount,
            });
            notificationsSent += resp.successCount;
            removeBadTokens(dbAdmin, teacherId, fcmTokens, entry.tokenDocPaths, resp);
          } catch (groupFcmErr: any) {
            console.error(`FCM group reminder error for teacher ${teacherId}:`, groupFcmErr);
            await groupSentRef
              .set({
                status: 'failed',
                error: groupFcmErr instanceof Error ? groupFcmErr.message : String(groupFcmErr),
                teacherId,
                groupSlotId: item.id,
                day: todayStr,
                failedAt: new Date().toISOString(),
              })
              .catch(() => {});
          }
        }

        // Morning summary: once a day, from the teacher's chosen time (default 07:00) for up to 2 hours.
        const morningAt = timeToMinutes(teacherData.morningSummaryTime) ?? 7 * 60;
        if (teacherData.morningSummaryEnabled !== false && isInMorningWindow(currentTotalMinutes, morningAt)) {
          const todayItems = [
            ...groupItems,
            ...getIndividualAgenda(
              schedulesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
              currentDayOfWeek,
              todayStr
            ),
          ];
          const morningMsg = buildAgendaMessage({ teacherName: teacherData.name, items: todayItems, mode: 'morning' });
          if (morningMsg) {
            const morningRef = sentCol.doc(`sent_morning_${teacherId}_${todayStr}`);
            if (await claimReminder(dbAdmin, morningRef, { teacherId, kind: 'morning', day: todayStr })) {
              try {
                const resp = await sendPush(messagingAdmin, fcmTokens, morningMsg, { kind: 'morning' }, 10800);
                await morningRef.set({
                  status: 'sent',
                  teacherId,
                  kind: 'morning',
                  day: todayStr,
                  sentAt: new Date().toISOString(),
                  fcmSuccessCount: resp.successCount,
                });
                notificationsSent += resp.successCount;
                removeBadTokens(dbAdmin, teacherId, fcmTokens, entry.tokenDocPaths, resp);
              } catch (morningErr: any) {
                console.error(`FCM morning summary error for teacher ${teacherId}:`, morningErr);
                await morningRef
                  .set({
                    status: 'failed',
                    error: morningErr instanceof Error ? morningErr.message : String(morningErr),
                    teacherId,
                    kind: 'morning',
                    day: todayStr,
                    failedAt: new Date().toISOString(),
                  })
                  .catch(() => {});
              }
            }
          }
        }
      } catch (groupErr) {
        console.warn(`Group / morning reminder error for teacher ${teacherId}:`, groupErr);
      }

      // Check due tasks for teacher
      try {
        const tasksSnap = await dbAdmin
          .collection('teachers')
          .doc(teacherId)
          .collection('tasks')
          .where('completed', '!=', true)
          .get();

        for (const taskDoc of tasksSnap.docs) {
          const task = taskDoc.data();
          if (!task || !task.title) continue;

          // Check if task is due today
          const taskDueDate = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
          if (taskDueDate && taskDueDate === todayStr) {
            const taskReminderId = `sent_task_${teacherId}_${taskDoc.id}_${todayStr}`;
            const taskSentRef = dbAdmin
              .collection('teachers')
              .doc(teacherId)
              .collection('sentReminders')
              .doc(taskReminderId);

            const taskSentDoc = await taskSentRef.get();
            if (!taskSentDoc.exists) {
              await taskSentRef.set({ status: 'sent', taskId: taskDoc.id, teacherId, day: todayStr, sentAt: new Date().toISOString() });
              const sendResponse = await messagingAdmin.sendEachForMulticast({
                tokens: fcmTokens,
                notification: {
                  title: '📝 تذكير بمهمة مطلوبة اليوم',
                  body: `أستاذ/ـة ${teacherData.name || 'المعلم'}، لديك مهمة مستحقة اليوم: "${task.title}".`,
                },
                data: {
                  taskId: taskDoc.id,
                  tag: 'task-reminder',
                },
                webpush: {
                  notification: {
                    title: '📝 تذكير بمهمة مطلوبة اليوم',
                    body: `أستاذ/ـة ${teacherData.name || 'المعلم'}، لديك مهمة مستحقة اليوم: "${task.title}".`,
                    icon: '/pwa-192x192.png',
                    badge: '/favicon.ico',
                  },
                  headers: { Urgency: 'high', TTL: '10800' },
                  fcmOptions: {
                    link: '/',
                  },
                },
              });
              notificationsSent += sendResponse.successCount;
            }
          }
        }
      } catch (taskErr) {
        console.warn(`Task reminder error for teacher ${teacherId}:`, taskErr);
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

// Sent right after the teacher signs in on a device: confirms that notifications work and lists today's classes.
// At most once per 6-hour block per day; respects the subscription, reminder switches and Do-Not-Disturb.
app.post('/api/reminders/login-summary', verifyFirebaseToken, userRateLimiter, async (req, res) => {
  try {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'رمز الدخول غير صالح.' });

    const dbAdmin = getAdminDb();
    const teacherDoc = await dbAdmin.collection('teachers').doc(uid).get();
    if (!teacherDoc.exists) return res.json({ success: true, sent: 0, reason: 'no-profile' });
    const teacherData = teacherDoc.data() || {};

    if (evaluateSubscription(teacherData, new Date()) !== 'active') {
      return res.json({ success: true, sent: 0, reason: 'subscription' });
    }
    if (teacherData.remindersEnabled === false || teacherData.teacherNotificationsEnabled === false) {
      return res.json({ success: true, sent: 0, reason: 'disabled' });
    }

    const tz = teacherData.timezone || 'Africa/Cairo';
    const { todayStr, currentDayOfWeek, currentTotalMinutes } = getTimezoneNowParts(tz);
    if (isMutedByDnd(teacherData.doNotDisturb, currentDayOfWeek, currentTotalMinutes)) {
      return res.json({ success: true, sent: 0, reason: 'dnd' });
    }

    const teacherRef = dbAdmin.collection('teachers').doc(uid);
    const tokensSnap = await teacherRef.collection('fcmTokens').get();
    const tokenDocPaths = new Map<string, string>();
    const tokens: string[] = [];
    tokensSnap.forEach((d) => {
      const t = d.data()?.token || d.id;
      if (t && !tokens.includes(t)) {
        tokens.push(t);
        tokenDocPaths.set(t, d.ref.path);
      }
    });
    if (tokens.length === 0) return res.json({ success: true, sent: 0, reason: 'no-tokens' });

    const bucket = Math.floor(currentTotalMinutes / 360);
    const sentRef = teacherRef.collection('sentReminders').doc(`sent_login_${uid}_${todayStr}_${bucket}`);
    if (!(await claimReminder(dbAdmin, sentRef, { teacherId: uid, kind: 'login', day: todayStr }))) {
      return res.json({ success: true, sent: 0, reason: 'already-sent' });
    }

    try {
      const [schedSnap, groupsSnap] = await Promise.all([
        teacherRef.collection('schedules').where('dayOfWeek', '==', currentDayOfWeek).get(),
        teacherRef.collection('groups').get(),
      ]);
      const items = [
        ...getGroupAgenda(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })), currentDayOfWeek),
        ...getIndividualAgenda(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })), currentDayOfWeek, todayStr),
      ];
      const msg = buildAgendaMessage({ teacherName: teacherData.name, items, mode: 'login' })!;
      const resp = await sendPush(getAdminMessaging(getApps()[0]), tokens, msg, { kind: 'login' }, 600);
      await sentRef.set({
        status: 'sent',
        teacherId: uid,
        kind: 'login',
        day: todayStr,
        sentAt: new Date().toISOString(),
        fcmSuccessCount: resp.successCount,
      });
      removeBadTokens(dbAdmin, uid, tokens, tokenDocPaths, resp);
      return res.json({ success: true, sent: resp.successCount, failed: resp.failureCount });
    } catch (sendErr: any) {
      await sentRef
        .set({
          status: 'failed',
          teacherId: uid,
          kind: 'login',
          day: todayStr,
          error: sendErr instanceof Error ? sendErr.message : String(sendErr),
          failedAt: new Date().toISOString(),
        })
        .catch(() => {});
      throw sendErr;
    }
  } catch (err) {
    console.error('Error in POST /api/reminders/login-summary:', err);
    return res.status(500).json({ error: 'تعذر إرسال إشعار الدخول.' });
  }
});

// Health check endpoint with real checks (Firebase Admin, Upstash Redis ping, Gemini key presence)
app.get('/api/health', async (_req, res) => {
  let firebaseOk = false;
  let redisStatus: 'ok' | 'unavailable' | 'not_configured' = 'not_configured';
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  try {
    const dbAdmin = getAdminDb();
    await dbAdmin.collection('admins').limit(1).get();
    firebaseOk = true;
  } catch (err) {
    console.error('Health check Firebase check failure:', err instanceof Error ? err.message : 'unknown');
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (redisUrl && redisToken) {
    try {
      const pingRes = await fetch(`${redisUrl.replace(/\/$/, '')}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
      redisStatus = pingRes.ok ? 'ok' : 'unavailable';
    } catch {
      redisStatus = 'unavailable';
    }
  }

  const isHealthy = firebaseOk && geminiConfigured && (redisStatus !== 'unavailable');
  return res.status(isHealthy ? 200 : 503).json({
    ok: isHealthy,
    firebase: firebaseOk,
    redis: redisStatus,
    geminiConfigured,
  });
});

// Automated 15-Minute Class Reminders & WhatsApp/Notifications API Route (Protected)
app.use('/api/reminders', verifyFirebaseToken, userRateLimiter, createRemindersRouter());

// Centralized error boundary: never expose internal stack traces or provider details.
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled API error:', error instanceof Error ? error.message : 'unknown');
  return res.status(500).json({ error: 'حدث خطأ داخلي غير متوقع.' });
});

// Local Server Runner (Vercel Serverless executes app directly via /api/index.ts)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
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