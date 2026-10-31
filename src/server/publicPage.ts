// Public teacher page: pure validation / sanitizing helpers (no Firestore, easy to test).
// IMPORTANT: this file runs as native ESM on Vercel -> relative imports must end with .js (none are needed here).

export const STAGES = ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعي', 'كل المراحل'] as const;
export const MAX_SLOTS = 14;

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Lower-case letters (Arabic or Latin), digits and dashes; 3-40 chars. Returns '' when invalid. */
export function normalizeSlug(input: unknown): string {
  if (typeof input !== 'string') return '';
  const s = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length >= 3 && s.length <= 40 ? s : '';
}

export interface PublicSlot {
  day: number; // 0 = Sunday .. 6 = Saturday
  from: string; // HH:MM
  to: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeSlots(input: unknown): PublicSlot[] {
  if (!Array.isArray(input)) return [];
  const out: PublicSlot[] = [];
  for (const raw of input.slice(0, MAX_SLOTS)) {
    const day = Number((raw as any)?.day);
    const from = String((raw as any)?.from || '');
    const to = String((raw as any)?.to || '');
    if (!Number.isInteger(day) || day < 0 || day > 6 || !TIME.test(from) || !TIME.test(to) || from >= to) continue;
    out.push({ day, from, to });
  }
  return out;
}

/** Only these fields can ever be published. Student data is never part of it. */
export function sanitizePublicProfile(body: Record<string, unknown>) {
  const stages = Array.isArray(body.stages)
    ? [...new Set(body.stages.filter((x): x is string => typeof x === 'string' && (STAGES as readonly string[]).includes(x)))]
    : [];
  const years = Number(body.experienceYears);
  return {
    enabled: body.enabled === true,
    directoryListed: body.directoryListed === true,
    name: clean(body.name, 80),
    subject: clean(body.subject, 60),
    stages,
    experienceYears: Number.isFinite(years) ? Math.min(60, Math.max(0, Math.round(years))) : 0,
    bio: clean(body.bio, 500),
    city: clean(body.city, 60),
    slots: sanitizeSlots(body.slots),
  };
}

export function validateBooking(body: Record<string, unknown>): { ok: true; value: Record<string, any> } | { ok: false; error: string } {
  if (typeof body.website === 'string' && body.website.trim()) return { ok: false, error: 'تعذر إرسال الطلب.' }; // honeypot
  const studentName = clean(body.studentName, 80);
  const parentName = clean(body.parentName, 80);
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[^\d+]/g, '') : '';
  const stage = clean(body.stage, 30);
  const note = clean(body.note, 300);
  if (studentName.length < 2) return { ok: false, error: 'اكتب اسم الطالب.' };
  if (!/^\+?\d{8,15}$/.test(phone)) return { ok: false, error: 'رقم الموبايل غير صحيح.' };
  const slot = body.slot && typeof body.slot === 'object' ? sanitizeSlots([body.slot])[0] : undefined;
  return { ok: true, value: { studentName, parentName, phone, stage, note, slot: slot || null } };
}

/** What anyone on the internet may see about a teacher (no ids, no phone, no emails). */
export function toPublicView(p: Record<string, any>) {
  return {
    slug: String(p.slug || ''),
    name: String(p.name || ''),
    subject: String(p.subject || ''),
    stages: Array.isArray(p.stages) ? p.stages : [],
    experienceYears: Number(p.experienceYears) || 0,
    bio: String(p.bio || ''),
    city: String(p.city || ''),
    slots: sanitizeSlots(p.slots),
  };
}
