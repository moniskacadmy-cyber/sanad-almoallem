/**
 * Server-side subscription access control (fail-closed).
 *
 * This module is intentionally free of firebase-admin / express imports so it
 * can be unit-tested without any external services. Data access is injected.
 *
 * Decision table (see tests/subscriptionAccess.test.ts):
 *   - teacher doc missing                        -> 403 teacher_profile_missing
 *   - Firestore unavailable / unknown failure    -> 503 verification_unavailable
 *   - admin (admins/{uid} exists)                -> allowed
 *   - isActive === false                         -> 403 account_deactivated
 *   - expiry date present, in the future         -> allowed
 *   - expiry date present, in the past           -> 403 subscription_expired
 *   - expiry date present but unparsable         -> 403 subscription_invalid
 *   - no expiry date at all                      -> 403 subscription_invalid
 *     (the client UI and the Firestore rules treat "no expiry" as expired too)
 */

export type AccessErrorCode =
  | 'unauthenticated'
  | 'teacher_profile_missing'
  | 'account_deactivated'
  | 'subscription_expired'
  | 'subscription_invalid'
  | 'verification_unavailable';

export type AccessDecision =
  | { ok: true; uid: string; reason: 'admin' | 'active_subscription' }
  | { ok: false; status: 401 | 403 | 503; code: AccessErrorCode; message: string };

/** Minimal shape of a Firestore Timestamp (client or admin SDK, serialized or not). */
interface TimestampLike {
  toDate?: () => Date;
  _seconds?: number;
  seconds?: number;
}

/**
 * Converts every date representation used in this project into a Date.
 * Returns null for null/undefined/empty/invalid values (never throws).
 *
 * Supported: Firestore Timestamp (toDate), serialized Timestamp
 * ({_seconds}/{seconds}), JS Date, Unix milliseconds (number), ISO strings.
 */
export function parseExpiryDateServer(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'object') {
    const ts = val as TimestampLike;
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  }

  return null;
}

export interface TeacherSubscriptionData {
  isActive?: unknown;
  subscriptionEndDate?: unknown;
  subscriptionExpiresAt?: unknown;
  trialEndDate?: unknown;
}

export type SubscriptionEvaluation =
  | 'active'
  | 'deactivated'
  | 'expired'
  | 'invalid';

/** Pure evaluation of a teacher document's subscription state. */
export function evaluateSubscription(
  data: TeacherSubscriptionData | null | undefined,
  now: Date = new Date()
): SubscriptionEvaluation {
  if (!data || typeof data !== 'object') return 'invalid';
  if (data.isActive === false) return 'deactivated';

  // Same precedence as the client (App.tsx / firebase.ts), with the trial end
  // date kept as the last fallback (existing server behaviour).
  const rawExpiry =
    data.subscriptionEndDate || data.subscriptionExpiresAt || data.trialEndDate;

  if (!rawExpiry) return 'invalid';

  const expiry = parseExpiryDateServer(rawExpiry);
  if (!expiry) return 'invalid';

  return expiry.getTime() > now.getTime() ? 'active' : 'expired';
}

export interface AccessDeps {
  /** Returns the teacher document data, or null when it does not exist. May throw. */
  readTeacher(uid: string): Promise<TeacherSubscriptionData | null>;
  /** Returns true when admins/{uid} exists. May throw. */
  isAdmin(uid: string): Promise<boolean>;
  now?: () => Date;
  /** Receives unexpected errors; must never log secrets or document contents. */
  logError?: (message: string, err: unknown) => void;
}

const MESSAGES: Record<AccessErrorCode, string> = {
  unauthenticated: 'غير مصرح به: يلزم تسجيل الدخول.',
  teacher_profile_missing: 'لم يتم العثور على ملفك الشخصي. يرجى إكمال إنشاء الحساب أولاً.',
  account_deactivated: 'تم إيقاف حسابك. يرجى التواصل مع الدعم.',
  subscription_expired: 'اشتراكك غير ساري أو انتهت صلاحيته. يرجى تجديد الاشتراك لاستخدام هذه الميزة.',
  subscription_invalid: 'تعذر التحقق من اشتراكك. يرجى التواصل مع الدعم.',
  verification_unavailable: 'تعذر التحقق من الاشتراك مؤقتاً. يرجى المحاولة بعد قليل.',
};

function deny(status: 401 | 403 | 503, code: AccessErrorCode): AccessDecision {
  return { ok: false, status, code, message: MESSAGES[code] };
}

/**
 * Authorizes a verified Firebase uid for paid features.
 * `uid` MUST come from a verified ID token, never from the request body.
 */
export async function authorizeActiveSubscription(
  uid: string | undefined | null,
  deps: AccessDeps
): Promise<AccessDecision> {
  if (!uid || typeof uid !== 'string') return deny(401, 'unauthenticated');

  const now = (deps.now ?? (() => new Date()))();

  try {
    if (await deps.isAdmin(uid)) {
      return { ok: true, uid, reason: 'admin' };
    }

    const teacher = await deps.readTeacher(uid);
    if (!teacher) return deny(403, 'teacher_profile_missing');

    switch (evaluateSubscription(teacher, now)) {
      case 'active':
        return { ok: true, uid, reason: 'active_subscription' };
      case 'deactivated':
        return deny(403, 'account_deactivated');
      case 'expired':
        return deny(403, 'subscription_expired');
      default:
        return deny(403, 'subscription_invalid');
    }
  } catch (err) {
    // Unknown failure while verifying: NEVER grant access. This is an outage,
    // not an expired subscription, so answer 503.
    deps.logError?.('Subscription verification failed', err);
    return deny(503, 'verification_unavailable');
  }
}

/* ------------------------------------------------------------------ */
/* Express-compatible middleware (structural types, no express import) */
/* ------------------------------------------------------------------ */

/**
 * Builds a middleware that must run AFTER the Firebase ID-token middleware
 * (which sets req.user from the verified token).
 */
export function createSubscriptionGuard(deps: AccessDeps) {
  return async function requireActiveSubscription(
    req: any,
    res: any,
    next: any
  ): Promise<void> {
    const decision = await authorizeActiveSubscription(req.user?.uid, deps);
    if (!decision.ok) {
      res.status(decision.status).json({ error: decision.message, code: decision.code });
      return;
    }
    next();
  };
}
