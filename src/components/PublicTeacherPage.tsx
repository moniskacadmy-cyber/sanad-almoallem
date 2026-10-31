import React, { useEffect, useState } from 'react';
import { DAY_NAMES, getDirectory, getPublicTeacher, sendBooking, type PublicSlot, type PublicTeacher } from '../services/publicApi';

const input = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white';
const shell = 'min-h-screen bg-slate-950 text-white p-4 max-w-md mx-auto space-y-4';

const Directory: React.FC = () => {
  const [q, setQ] = useState('');
  const [list, setList] = useState<PublicTeacher[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      getDirectory(q).then(setList).catch((e) => setErr(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className={shell} dir="rtl">
      <h1 className="text-lg font-bold">ابحث عن معلم 🔎</h1>
      <input className={input} placeholder="اسم المعلم أو المادة أو المدينة" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="text-xs text-rose-300">{err}</p>}
      {list?.length === 0 && <p className="text-xs text-slate-400">لا توجد نتائج.</p>}
      {list?.map((t) => (
        <a key={t.slug} href={`/t/${encodeURIComponent(t.slug)}`} className="block rounded-2xl bg-slate-900 border border-purple-500/20 p-3.5">
          <div className="font-bold">{t.name}</div>
          <div className="text-xs text-purple-300">{t.subject}{t.city ? ` • ${t.city}` : ''}</div>
          {t.bio && <div className="text-xs text-slate-400 mt-1">{t.bio}</div>}
        </a>
      ))}
    </div>
  );
};

const Teacher: React.FC<{ slug: string }> = ({ slug }) => {
  const [t, setT] = useState<PublicTeacher | null>(null);
  const [err, setErr] = useState('');
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [form, setForm] = useState({ studentName: '', parentName: '', phone: '', stage: '', note: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    getPublicTeacher(slug).then(setT).catch((e) => setErr(e.message));
  }, [slug]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t?.name, text: `أ. ${t?.name} - ${t?.subject}`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormErr('');
    try {
      await sendBooking({ ...form, slug, slot });
      setSent(true);
    } catch (e2: any) {
      setFormErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  if (err) return <div className={shell} dir="rtl"><p className="text-sm text-slate-300 text-center mt-20">{err}</p></div>;
  if (!t) return <div className={shell} dir="rtl"><p className="text-sm text-slate-400 text-center mt-20">جارٍ التحميل...</p></div>;

  return (
    <div className={shell} dir="rtl">
      <div className="rounded-3xl bg-gradient-to-br from-purple-700 to-indigo-800 p-5 space-y-1.5">
        <h1 className="text-xl font-bold">أ. {t.name}</h1>
        <p className="text-sm text-purple-100">مدرس {t.subject}{t.city ? ` • ${t.city}` : ''}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {t.stages.map((s) => <span key={s} className="text-[11px] bg-white/15 rounded-full px-2.5 py-0.5">{s}</span>)}
          {t.experienceYears > 0 && <span className="text-[11px] bg-white/15 rounded-full px-2.5 py-0.5">خبرة {t.experienceYears} سنة</span>}
        </div>
      </div>
      {t.bio && <p className="text-sm text-slate-300 leading-relaxed">{t.bio}</p>}
      <button type="button" onClick={share} className="w-full py-2.5 rounded-xl bg-slate-800 text-sm font-bold">🔗 مشاركة الصفحة</button>

      {sent ? (
        <div className="rounded-2xl bg-emerald-950/60 border border-emerald-500/40 p-4 text-sm text-emerald-200">
          تم إرسال طلب الحجز ✅ هيتواصل معاك الأستاذ قريبًا على الرقم اللي كتبته.
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-2xl bg-slate-900 border border-purple-500/20 p-4 space-y-3">
          <h2 className="font-bold">احجز حصة</h2>
          {t.slots.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">المواعيد المتاحة (اختياري):</p>
              <div className="flex flex-wrap gap-1.5">
                {t.slots.map((s, i) => {
                  const active = slot && slot.day === s.day && slot.from === s.from;
                  return (
                    <button key={i} type="button" onClick={() => setSlot(active ? null : s)}
                      className={`text-xs rounded-xl px-3 py-1.5 border ${active ? 'bg-purple-600 border-purple-400' : 'bg-slate-950 border-slate-700'}`}>
                      {DAY_NAMES[s.day]} {s.from}-{s.to}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <input className={input} placeholder="اسم الطالب *" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} required />
          <input className={input} placeholder="اسم ولي الأمر" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
          <input className={input} placeholder="رقم الموبايل (واتساب) *" inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <select className={input} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            <option value="">المرحلة الدراسية</option>
            {(t.stages.length ? t.stages : ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعي']).map((s) => <option key={s}>{s}</option>)}
          </select>
          <textarea className={input} rows={2} placeholder="ملاحظات (اختياري)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {/* honeypot: real people never see/fill this */}
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" aria-hidden="true" />
          {formErr && <p className="text-xs text-rose-300">{formErr}</p>}
          <button disabled={busy} className="w-full py-3 rounded-xl bg-purple-600 font-bold disabled:opacity-60">{busy ? 'جارٍ الإرسال...' : 'إرسال طلب الحجز'}</button>
          <p className="text-[10px] text-slate-500">بياناتك بتوصل للأستاذ بس، ومش بتظهر لأي حد تاني.</p>
        </form>
      )}
    </div>
  );
};

export const PublicTeacherPage: React.FC = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'teachers') return <Directory />;
  let slug = '';
  try {
    slug = decodeURIComponent(parts[1] || '');
  } catch {
    slug = '';
  }
  return <Teacher slug={slug} />;
};

export default PublicTeacherPage;
