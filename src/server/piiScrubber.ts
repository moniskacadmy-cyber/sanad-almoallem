/**
 * PII (Personally Identifiable Information) Scrubber & Masker
 * Protects student names, contact details, emails, phones, tokens, and credentials from server logs.
 */

const EMAIL_REGEX = /\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*([a-zA-Z0-9])@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
const SIMPLE_EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// International and Arab phone patterns (Egypt, Saudi Arabia, Gulf, etc.)
// e.g. +201025967471, 01025967471, +966501234567, 0501234567
const PHONE_REGEX = /(\+?[0-9]{1,4}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?[\d\s-]{6,12}\d/g;

// Tokens and secrets
const BEARER_TOKEN_REGEX = /Bearer\s+([A-Za-z0-9._~+/-]+=*)/gi;
const FIREBASE_API_KEY_REGEX = /\bAIza[0-9A-Za-z-_]{35}\b/g;
const GENERIC_TOKEN_REGEX = /\b(ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g;

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'token',
  'refreshtoken',
  'idtoken',
  'secret',
  'authorization',
  'creditcard',
  'cardnumber',
  'cvv',
  'apikey',
  'serviceaccount',
  'privatekey',
  'private_key',
  'fcmtoken',
  'devicetoken',
]);

/**
 * Mask an email address: user@domain.com -> u***r@domain.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.replace(SIMPLE_EMAIL_REGEX, (match) => {
    const atIndex = match.indexOf('@');
    if (atIndex <= 1) return `*@${match.slice(atIndex + 1)}`;
    const userPart = match.slice(0, atIndex);
    const domainPart = match.slice(atIndex);
    if (userPart.length <= 2) {
      return `${userPart[0]}*${domainPart}`;
    }
    return `${userPart[0]}***${userPart[userPart.length - 1]}${domainPart}`;
  });
}

/**
 * Mask a phone number: +201025967471 -> +2010****471
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  // Clean non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length < 8) return phone;
  const startVisible = cleaned.startsWith('+') ? 5 : 3;
  const endVisible = 3;
  if (cleaned.length <= startVisible + endVisible) {
    return '***masked_phone***';
  }
  const prefix = cleaned.slice(0, startVisible);
  const suffix = cleaned.slice(-endVisible);
  return `${prefix}****${suffix}`;
}

/**
 * Mask string for any PII patterns (emails, phones, bearer tokens, API keys, JWTs)
 */
export function maskPiiString(str: string): string {
  if (typeof str !== 'string') return str;

  // 1. Mask Bearer tokens
  let result = str.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');

  // 2. Mask Google/Firebase API keys
  result = result.replace(FIREBASE_API_KEY_REGEX, '[REDACTED_API_KEY]');

  // 3. Mask JWT tokens
  result = result.replace(GENERIC_TOKEN_REGEX, '[REDACTED_JWT]');

  // 4. Mask emails
  result = maskEmail(result);

  // 5. Mask standalone phone numbers (look for 10-15 digit sequences)
  result = result.replace(/(?:whatsapp|phone|tel|mobile|هاتف|موبايل|واتساب)?[:\s=]+(\+?[0-9]{9,15})/gi, (match, p1) => {
    return match.replace(p1, maskPhone(p1));
  });

  return result;
}

/**
 * Recursively scrubs PII from any value (string, object, array, Error)
 */
export function scrubPII<T = any>(value: T, depth = 0): T {
  if (depth > 6) return value; // Prevent infinite loops on circular objects

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return maskPiiString(value) as unknown as T;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    const sanitizedError = new Error(maskPiiString(value.message));
    sanitizedError.name = value.name;
    if (value.stack) {
      sanitizedError.stack = maskPiiString(value.stack);
    }
    return sanitizedError as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubPII(item, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
        result[k] = '[REDACTED]';
      } else if (lowerKey.includes('email')) {
        result[k] = typeof v === 'string' ? maskEmail(v) : scrubPII(v, depth + 1);
      } else if (lowerKey.includes('phone') || lowerKey.includes('whatsapp')) {
        result[k] = typeof v === 'string' ? maskPhone(v) : scrubPII(v, depth + 1);
      } else {
        result[k] = scrubPII(v, depth + 1);
      }
    }
    return result as unknown as T;
  }

  return value;
}

/**
 * Intercept global console logs and automatically mask PII in all logging output
 */
export function installPiiLogInterceptor(): void {
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;

  for (const method of methods) {
    const originalMethod = console[method];
    if (typeof originalMethod === 'function') {
      console[method] = function (...args: any[]) {
        try {
          const sanitizedArgs = args.map((arg) => scrubPII(arg));
          return originalMethod.apply(console, sanitizedArgs);
        } catch (_) {
          return originalMethod.apply(console, args);
        }
      };
    }
  }
}
