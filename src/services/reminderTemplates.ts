/**
 * Saved reminder templates. The teacher's edited WhatsApp reminder is stored with {{placeholders}}
 * instead of the literal student name / amounts, so the next time it is opened the dynamic parts
 * (name, amount due, remaining lessons...) are filled with the CURRENT values, not stale ones.
 */
export type ReminderKind = 'schedule' | 'dues' | 'prepaid' | 'custom' | 'welcome';

/** Default group welcome message (editable + saveable by the teacher). */
export const DEFAULT_GROUP_WELCOME = `أهلاً ومرحباً بكم جميعاً في بيئتنا التعليمية المباركة (أكاديمية مؤنسك / سند المعلم).
يسعدني انضمامكم معنا لنبدأ سوياً رحلة تعليمية متميزة ومنظمة نحو التفوق والنجاح. نهدف هنا إلى تقديم محتوى علمي راقٍ ومتابعة دقيقة لكل طالب وطالبة لتحقيق أفضل النتائج بإذن الله.\n\n📌 تنبيهات هامة لضمان أفضل تجربة:\n\n• يُرجى مراجعة مواعيد الحصص الخاصة بكم والمتابعة المستمرة عبر الجدول.\n• سيتم نشر التذكيرات والمواعيد بشكل منتظم، مع مراعاة الفروق الزمنية لدولتنا الحبيبة والدول المجاورة لضمان التنسيق التام.\n• هذا الجروب مخصص للتواصل الفعّال وكل ما يخص العملية التعليمية.\n\nنسأل الله التوفيق لنا ولكم، وبداية موفقة لجميع الطلاب والطالبات.\nمع خالص تحياتي وتقديري.`;

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

export type Gender = 'male' | 'female' | undefined;

export const studentWord = (g: Gender) => (g === 'male' ? 'الطالب' : g === 'female' ? 'الطالبة' : 'الطالب/ة');
export const teacherWord = (g: Gender) => (g === 'female' ? 'أستاذة' : 'أستاذ');

/** Swaps one gendered word for another as a whole Arabic word (so 'الطالب' never matches inside 'الطالبة'). */
export function swapWord(text: string, from: string, to: string): string {
  if (from === to) return text;
  const re = new RegExp(`(?<![\\u0600-\\u06FF])${escapeRe(from)}(?![\\u0600-\\u06FF/])`, 'g');
  return text.replace(re, to);
}
