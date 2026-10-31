import React, { useCallback, useEffect, useState } from 'react';
import type { TeacherProfile } from '../types';
import {
  DAY_NAMES,
  decideBooking,
  getMyBookings,
  getMyPublicProfile,
  publicPageUrl,
  saveMyPublicProfile,
  type BookingRow,
  type PublicProfileForm,
} from '../services/publicApi';
import { buildAdPosts } from '../services/adPosts';

const STAGES = ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعي', 'كل المراحل'];
const field = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white';
const small = 'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50';

const slugFromName = (n: string) => n.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 40);

export const PublicPagePanel: React.FC<{ profile: TeacherProfile }> = ({ profile }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PublicProfileForm>({
    slug: slugFromName(profile.name || ''),
    name: profile.name || '',
    subject: profile.subject || '',
    stages: [],
    experienceYears: 0,
    bio: '',
    city: '',
    slots: [],
    enabled: false,
    directoryListed: false,
  });
  const [saved, setSaved] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const p = await getMyPublicProfile();
      if (p) {
        setForm(p);
        setSaved(true);
      }
      setBookings(await getMyBookings());
    } catch (e: any) {
      setMsg(e.message);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e: any) {
      setMsg(e?.message || 'حصلت مشكلة.');
    } finally {
      setBusy(false);
    }
  };

  const pending = bookings.filter((b) => b.status === 'pending').length;
  const url = saved ? publicPageUrl(form.slug) : '';
  const ads = buildAdPosts(form, url || '(الرابط بعد الحفظ)');
  const set = (patch: Partial<PublicProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-indigo-500/25 overflow-hidden" dir="rtl">
      <button type="button" onClick={() => setOpen(!open)} className="w-full p-3.5 flex items-center justify-between text-right cursor-pointer">
        <span className="text-sm font-bold text-white">
          🌐 صفحتك العامة وحجز الحصص {pending > 0 && <span className="bg-rose-600 text-[10px] rounded-full px-2 py-0.5 mr-1">{pending} طلب جديد</span>}
        </span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-3.5 pt-0 space-y-3 text-xs text-slate-200">
          <label className="flex items-center gap-2 font-bold">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            تفعيل الصفحة العامة
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.directoryListed} disabled={!form.enabled} onChange={(e) => set({ directoryListed: e.target.checked })} />
            إظهاري في دليل "ابحث عن معلم"
          </label>

          <div className="space-y-2">
            <input className={field} dir="ltr" placeholder="رابط الصفحة (حروف وأرقام وشرطة)" value={form.slug} onChange={(e) => set({ slug: e.target.value })} />
            <input className={field} placeholder="الاسم" value={form.name} onChange={(e) => set({ name: e.target.value })} />
            <input className={field} placeholder="المادة" value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
            <input className={field} placeholder="المدينة (اختياري)" value={form.city} onChange={(e) => set({ city: e.target.value })} />
            <input className={field} type="number" min={0} max={60} placeholder="سنوات الخبرة" value={form.experienceYears || ''} onChange={(e) => set({ experienceYears: Number(e.target.value) || 0 })} />
            <textarea className={field} rows={3} maxLength={500} placeholder="نبذة عنك (بتظهر للجميع)" value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => {
              const on = form.stages.includes(s);
              return (
                <button key={s} type="button" onClick={() => set({ stages: on ? form.stages.filter((x) => x !== s) : [...form.stages, s] })}
                  className={`${small} ${on ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{s}</button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="font-bold">المواعيد المتاحة للحجز</p>
            {form.slots.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select className={field} value={s.day} onChange={(e) => set({ slots: form.slots.map((x, k) => (k === i ? { ...x, day: Number(e.target.value) } : x)) })}>
                  {DAY_NAMES.map((d, di) => <option key={di} value={di}>{d}</option>)}
                </select>
                <input type="time" className={field} value={s.from} onChange={(e) => set({ slots: form.slots.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)) })} />
                <input type="time" className={field} value={s.to} onChange={(e) => set({ slots: form.slots.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)) })} />
                <button type="button" onClick={() => set({ slots: form.slots.filter((_, k) => k !== i) })}>✖️</button>
              </div>
            ))}
            {form.slots.length < 14 && (
              <button type="button" className={`${small} bg-slate-800`} onClick={() => set({ slots: [...form.slots, { day: 6, from: '16:00', to: '17:00' }] })}>➕ إضافة موعد</button>
            )}
          </div>

          <button type="button" disabled={busy} className={`${small} bg-emerald-600 text-white w-full py-2.5`}
            onClick={() => run(async () => {
              const r = await saveMyPublicProfile(form);
              set({ slug: r.slug });
              setSaved(true);
              setMsg('تم الحفظ ✅');
            })}>
            {busy ? 'جارٍ الحفظ...' : 'حفظ الصفحة'}
          </button>
          {msg && <p className="text-amber-200">{msg}</p>}

          {saved && form.enabled && (
            <div className="space-y-2 rounded-xl bg-slate-950/60 p-2.5">
              <p className="break-all text-emerald-200" dir="ltr">{url}</p>
              <div className="flex gap-2">
                <button type="button" className={`${small} bg-slate-700`} onClick={() => navigator.clipboard?.writeText(url)}>نسخ الرابط</button>
                <button type="button" className={`${small} bg-purple-600 text-white`}
                  onClick={() => (navigator.share ? navigator.share({ title: form.name, url }).catch(() => {}) : navigator.clipboard?.writeText(url))}>مشاركة</button>
              </div>
            </div>
          )}

          {saved && form.enabled && (
            <div className="space-y-2">
              <p className="font-bold">📣 منشورات جاهزة للإعلان</p>
              {ads.map((a) => (
                <div key={a.id} className="rounded-xl bg-slate-950/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between"><span className="font-bold">{a.label}</span>
                    <button type="button" className={`${small} bg-slate-700`} onClick={() => navigator.clipboard?.writeText(a.text)}>نسخ</button></div>
                  <pre className="whitespace-pre-wrap text-[11px] text-slate-300 font-sans">{a.text}</pre>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="font-bold">📥 طلبات الحجز ({bookings.length})</p>
            {bookings.length === 0 && <p className="text-slate-500">لا توجد طلبات بعد.</p>}
            {bookings.map((b) => {
              const wa = `https://wa.me/${b.phone.replace(/^0/, '20').replace(/\D/g, '')}?text=${encodeURIComponent(`السلام عليكم، بخصوص طلب حجز ${b.studentName} عند أ. ${form.name}`)}`;
              return (
                <div key={b.id} className="rounded-xl bg-slate-950/60 p-2.5 space-y-1">
                  <div className="font-bold">{b.studentName} {b.stage ? `• ${b.stage}` : ''}</div>
                  <div className="text-slate-400" dir="ltr">{b.phone}</div>
                  {b.slot && <div>الموعد: {DAY_NAMES[b.slot.day]} {b.slot.from}-{b.slot.to}</div>}
                  {b.note && <div className="text-slate-300">{b.note}</div>}
                  <div className="flex items-center gap-1.5 pt-1">
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={`${small} bg-emerald-700 text-white`}>واتساب</a>
                    {b.status === 'pending' ? (
                      <>
                        <button type="button" className={`${small} bg-purple-600 text-white`} disabled={busy} onClick={() => run(async () => { await decideBooking(b.id, 'approved'); await load(); })}>قبول</button>
                        <button type="button" className={`${small} bg-slate-700`} disabled={busy} onClick={() => run(async () => { await decideBooking(b.id, 'rejected'); await load(); })}>رفض</button>
                      </>
                    ) : (
                      <span className={b.status === 'approved' ? 'text-emerald-300' : 'text-slate-500'}>{b.status === 'approved' ? 'تم القبول ✅' : 'مرفوض'}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicPagePanel;
