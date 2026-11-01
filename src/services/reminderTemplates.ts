/**
 * Saved reminder templates. The teacher's edited WhatsApp reminder is stored with {{placeholders}}
 * instead of the literal student name / amounts, so the next time it is opened the dynamic parts
 * (name, amount due, remaining lessons...) are filled with the CURRENT values, not stale ones.
 */
export type ReminderKind = 'schedule' | 'dues' | 'prepaid' | 'custom';

export type ReminderVars = Record<string, string>;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces literal dynamic values in `text` with {{key}} tokens. Longest values first. */
export function templatize(text: string, vars: ReminderVars): string {
  let out = text;
  const entries = Object.entries(vars)
    .filter(([, v]) => v && v.trim().length >= 1)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [key, value] of entries) {
    const v = escapeRe(value.trim());
    // Numbers must not be matched inside longer numbers; words are matched as-is.
    const re = /^[\d.,]+$/.test(value.trim()) ? new RegExp(`(?<![\\d.,])${v}(?![\\d])`, 'g') : new RegExp(v, 'g');
    out = out.replace(re, `{{${key}}}`);
  }
  return out;
}

/** Fills {{key}} tokens with the current values; unknown tokens are left untouched. */
export function fillTemplate(template: string, vars: ReminderVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
}
