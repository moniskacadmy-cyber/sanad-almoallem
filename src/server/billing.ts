import crypto from 'crypto';

export interface BillingPlan {
  id: string;
  name: string;
  priceEgp: number;
  days: number;
}

export const BILLING_PLANS: Record<string, BillingPlan> = {
  monthly: {
    id: 'monthly',
    name: 'الباقة الشهرية',
    priceEgp: 50,
    days: 30,
  },
  six_months: {
    id: 'six_months',
    name: 'باقة 6 شهور',
    priceEgp: 250,
    days: 180,
  },
  yearly: {
    id: 'yearly',
    name: 'الباقة السنوية',
    priceEgp: 450,
    days: 365,
  },
};

/**
 * Normalizes an email address and returns its SHA-256 hex digest.
 * Used for trial deduplication in trialsUsed/{sha256(normalizedEmail)}.
 */
export function hashNormalizedEmail(email: string): string {
  const normalized = (email || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Timing-safe HMAC signature verification for billing webhooks (Paymob / Stripe / Custom).
 */
export function verifyBillingHmacSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string | undefined
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const cleanSecret = secret.trim();
  const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

  // Strip 'sha256=' or 'sha512=' prefix if present
  const signatureToCompare = signatureHeader.startsWith('sha256=') || signatureHeader.startsWith('sha512=')
    ? signatureHeader.split('=')[1].trim()
    : signatureHeader.trim();

  // Try sha256 first
  const expectedHmacSha256 = crypto
    .createHmac('sha256', cleanSecret)
    .update(bodyString)
    .digest('hex');

  if (signatureToCompare.length === expectedHmacSha256.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(signatureToCompare), Buffer.from(expectedHmacSha256))) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  // Try sha512 (Paymob standard)
  const expectedHmacSha512 = crypto
    .createHmac('sha512', cleanSecret)
    .update(bodyString)
    .digest('hex');

  if (signatureToCompare.length === expectedHmacSha512.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(signatureToCompare), Buffer.from(expectedHmacSha512))) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Calculates new subscription dates by extending from max(now, currentEndDate).
 * Guarantees that paid remaining time is never lost when renewing early.
 */
export function calculateExtendedSubscriptionDates(
  currentEndDateOrIso: string | Date | undefined,
  planDays: number,
  fromDate: Date = new Date()
): { startDate: string; endDate: string } {
  const now = fromDate;
  let baseDate = now;

  if (currentEndDateOrIso) {
    const currentEnd = typeof currentEndDateOrIso === 'string' ? new Date(currentEndDateOrIso) : currentEndDateOrIso;
    if (currentEnd instanceof Date && !isNaN(currentEnd.getTime()) && currentEnd.getTime() > now.getTime()) {
      baseDate = currentEnd;
    }
  }

  const extendedEndMs = baseDate.getTime() + planDays * 24 * 60 * 60 * 1000;
  const newEndDate = new Date(extendedEndMs);

  return {
    startDate: baseDate.toISOString(),
    endDate: newEndDate.toISOString(),
  };
}
