import type { PublicTeacher } from './publicApi';

/** Ready-to-copy ads generated from the teacher's own public data (no AI, no cost). */
export function buildAdPosts(t: Pick<PublicTeacher, 'name' | 'subject' | 'stages' | 'experienceYears' | 'city'>, url: string) {
  const stages = t.stages.length ? t.stages.join(' و') : 'كل المراحل';
  const exp = t.experienceYears > 0 ? `خبرة ${t.experienceYears} سنة` : 'شرح مبسط ومتابعة مستمرة';
  const city = t.city ? ` - ${t.city}` : '';
  return [
    {
      id: 'facebook',
      label: 'فيسبوك',
      text: `📚 مدرس ${t.subject}${city}\nأ. ${t.name}\n✅ ${exp}\n✅ المراحل: ${stages}\n✅ متابعة دورية لولي الأمر\n\nاحجز حصتك الآن من هنا 👇\n${url}`,
    },
    {
      id: 'whatsapp',
      label: 'واتساب',
      text: `السلام عليكم 🌷\nأنا أ. ${t.name} مدرس ${t.subject} (${stages}).\n${exp}.\nللحجز ومعرفة المواعيد المتاحة:\n${url}`,
    },
    {
      id: 'instagram',
      label: 'انستجرام',
      text: `📖 ${t.subject} مع أ. ${t.name}\n${exp} ✨\nالمراحل: ${stages}\nرابط الحجز في البايو 🔗\n${url}\n\n#مدرس_خصوصي #${t.subject.replace(/\s+/g, '_')} #دروس_خصوصية`,
    },
  ];
}
