/**
 * Parses "1-3, 5, 8-10" into zero-based page indexes (sorted, unique, inside 1..total).
 * Throws an Arabic message for anything invalid so the UI can show it.
 */
export function parsePageRanges(input: string, total: number): number[] {
  const text = (input || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[،;]/g, ',').trim();
  if (!text) throw new Error('اكتب أرقام الصفحات، مثال: 1-3, 5');
  const pages = new Set<number>();
  for (const part of text.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(p);
    if (!m) throw new Error(`صيغة غير صحيحة: "${p}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > total || b > total) throw new Error(`الصفحة خارج النطاق (الملف فيه ${total} صفحة)`);
    if (a > b) throw new Error(`النطاق معكوس: "${p}"`);
    for (let i = a; i <= b; i++) pages.add(i - 1);
  }
  if (pages.size === 0) throw new Error('لم يتم اختيار أي صفحة');
  return [...pages].sort((x, y) => x - y);
}
