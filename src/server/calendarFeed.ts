import { createHash, randomBytes } from 'node:crypto';

/**
 * Calendar subscription feed (iCalendar / ICS), pure functions. The teacher gets ONE secret URL that Google
 * Calendar / Apple Calendar can subscribe to: no Google sign-in, no OAuth, so no "unverified app" warning.
 */

export function generateFeedToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashFeedToken(token: string): string {
  return createHash('sha256').update(String(token).trim()).digest('hex');
}

export function isPlausibleFeedToken(t: unknown): t is string {
  return typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t.trim());
}

export * from '../utils/icsBuilder.js';
