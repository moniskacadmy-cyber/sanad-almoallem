import React, { useCallback, useEffect, useState } from 'react';

/**
 * بوابة ولي الأمر (قراءة فقط). لا تستخدم Firebase إطلاقًا: ترسل الكود للسيرفر فقط،
 * والسيرفر يتحقق منه في كل طلب ويرجّع بيانات طالب واحد.
 */

const STORAGE_KEY = 'sanad_parent_code';
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  present: { text: 'حاضر', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  late: { text: 'متأخر', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  absent: { text: 'غائب', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  excused: { text: 'اعتذار', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
};

interface ParentView {
  teacherName: string;
  student: { name: string; subject: string; status: string };
  attendance: { date: string; status: string; note: string }[];
  attendanceSummary: { present: number; late: number; absent: number; excused: number };
  lessons: { date: string; topic: string; homework: string; rating: number | null; notes: string; strengths: string; challenges: string }[];
  schedule: { day: number; time: string; duration: number; subject: string }[];
  library: { id: string; title: string; type: string; subject: string; content: string; fileName: string }[];
  finance: { pendingDues: number; months: { month: string; status: string; amountPaid: number; amountDue: number }[] } | null;
}

function readInitialCode(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('parent');
    if (fromUrl && fromUrl.trim()) {
      localStorage.setItem(STORAGE_KEY, fromUrl.trim());
      // Remove the code from the address bar so it is not copied / shared by accident.
      window.history.replaceState({}, '', window.location.pathname);
      return fromUrl.trim();
    }
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export const ParentPortal: React.FC = () => {
  const [code, setCode] = useState<string>(readInitialCode);
  const [input, setInput] = useState('');
  const [view, setView] = useState<ParentView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (c: string) => {
    if (!c) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/parent/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.view) {
        if (res.status === 404) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setCode('');
        }
        setView(null);
        setError(json.error || 'تعذر تحميل البيانات.');
        return;
      }
      setView(json.view as ParentView);
    } catch {
      setError('تعذر الاتصال بالإنترنت. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) void load(code);
  }, [code, load]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = input.trim();
    if (!c) return;
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
    setCode(c);
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setView(null);
    setCode('');
    setInput('');
  };

  const shell = (children: React.ReactNode) => (
    <div dir="rtl" className="min-h-screen bg-[#070314] text-slate-100 flex justify-center">
      <div className="w-full max-w-[460px] min-h-screen px-4 py-5 space-y-4">{children}</div>
    </div>
  );

  if (!code || (!view && !loading && error)) {
    return shell(
      <>
        <div className="text-center pt-8 space-y-1">
          <div className="text-4xl">📚</div>
          <h1 className="text-lg font-extrabold">سند المعلم — بوابة ولي الأمر</h1>
          <p className="text-xs text-slate-400">ادخل الكود الذي أرسله لك المعلم لمتابعة ابنك (للعرض فقط)</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="الصق الكود هنا"
            autoComplete="off"
            dir="ltr"
            className="w-full rounded-xl bg-slate-900 border border-purple-500/30 px-3 py-3 text-sm text-white text-center"
          />
          {error && <p className="text-xs text-rose-300 text-center">{error}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-bold">
            دخول
          </button>
        </form>
      </>
    );
  }

  if (!view) {
    return shell(<p className="text-center text-slate-400 pt-24 text-sm">جارٍ تحميل البيانات...</p>);
  }

  const s = view.attendanceSummary;
  return shell(
    <>
      <header className="rounded-2xl bg-gradient-to-br from-purple-900/50 to-indigo-900/40 border border-purple-500/30 p-4">
        <p className="text-[11px] text-purple-200/80">الأستاذ/ة {view.teacherName || 'المعلم'}</p>
        <h1 className="text-lg font-extrabold mt-0.5">{view.student.name}</h1>
        <p className="text-xs text-slate-300 mt-0.5">
          {view.student.subject}
          {view.student.status !== 'active' && (
            <span className="mr-2 text-amber-300">• {view.student.status === 'paused' ? 'موقوف مؤقتًا' : 'مؤرشف'}</span>
          )}
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => void load(code)} className="text-[11px] px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-600/50">
            {loading ? '...' : '🔄 تحديث'}
          </button>
          <button onClick={logout} className="text-[11px] px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-600/50">
            خروج
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-4 space-y-3">
        <h2 className="text-sm font-bold">الحضور — آخر ٣٠ يوم</h2>
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          {(['present', 'late', 'absent', 'excused'] as const).map((k) => (
            <div key={k} className={`rounded-xl border p-2 ${STATUS_LABEL[k].cls}`}>
              <div className="text-base font-extrabold">{s[k]}</div>
              <div>{STATUS_LABEL[k].text}</div>
            </div>
          ))}
        </div>
        {view.attendance.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد سجلات حضور.</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {view.attendance.map((a) => (
              <li key={a.date} className="flex items-center justify-between text-xs border-b border-slate-800 py-1">
                <span className="font-mono text-slate-300">{a.date}</span>
                <span className={`px-2 py-0.5 rounded-full border ${STATUS_LABEL[a.status]?.cls || ''}`}>
                  {STATUS_LABEL[a.status]?.text || a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-4 space-y-2">
        <h2 className="text-sm font-bold">الحصص القادمة</h2>
        {view.schedule.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد مواعيد حاليًا.</p>
        ) : (
          view.schedule.map((x, i) => (
            <div key={i} className="flex items-center justify-between text-xs rounded-xl bg-slate-950/60 px-3 py-2">
              <span className="font-bold">{DAY_NAMES[x.day] || ''}</span>
              <span className="font-mono">{x.time}</span>
              <span className="text-slate-400">{x.subject} • {x.duration} د</span>
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-4 space-y-2">
        <h2 className="text-sm font-bold">الحصص والتقييمات</h2>
        {view.lessons.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد حصص مسجلة.</p>
        ) : (
          view.lessons.slice(0, 15).map((l, i) => (
            <div key={i} className="rounded-xl bg-slate-950/60 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-mono text-slate-400">{l.date}</span>
                {l.rating ? <span className="text-amber-300">{'⭐'.repeat(Math.min(5, l.rating))}</span> : null}
              </div>
              {l.topic && <div className="font-bold">{l.topic}</div>}
              {l.homework && <div className="text-slate-300">📝 الواجب: {l.homework}</div>}
              {l.strengths && <div className="text-emerald-300">👍 {l.strengths}</div>}
              {l.challenges && <div className="text-amber-300">⚠️ {l.challenges}</div>}
              {l.notes && <div className="text-slate-400">{l.notes}</div>}
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-4 space-y-2">
        <h2 className="text-sm font-bold">المذكرات والفيديوهات</h2>
        {view.library.length === 0 ? (
          <p className="text-xs text-slate-500">لم ينشر المعلم شيئًا بعد.</p>
        ) : (
          view.library.map((it) => (
            <div key={it.id} className="rounded-xl bg-slate-950/60 p-3 text-xs space-y-1">
              <div className="font-bold">{it.title}</div>
              {isUrl(it.content) ? (
                <a href={it.content.trim()} target="_blank" rel="noopener noreferrer" className="text-purple-300 underline break-all">
                  فتح الرابط 🔗
                </a>
              ) : it.content ? (
                <p className="text-slate-300 whitespace-pre-wrap line-clamp-6">{it.content}</p>
              ) : (
                <p className="text-slate-500">{it.fileName || 'ملف مرفق (متاح عند المعلم)'}</p>
              )}
            </div>
          ))
        )}
      </section>

      {view.finance && (
        <section className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-4 space-y-2">
          <h2 className="text-sm font-bold">الاشتراك والرصيد</h2>
          <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-center">
            <div className="text-[11px] text-rose-300">المتبقي</div>
            <div className="text-xl font-extrabold">{view.finance.pendingDues}</div>
          </div>
          {view.finance.months.map((m) => (
            <div key={m.month} className="flex justify-between text-xs border-b border-slate-800 py-1">
              <span className="font-mono">{m.month}</span>
              <span>
                {m.amountPaid} / {m.amountDue}
              </span>
              <span className={m.status === 'paid' ? 'text-emerald-300' : m.status === 'partial' ? 'text-amber-300' : 'text-rose-300'}>
                {m.status === 'paid' ? 'مدفوع' : m.status === 'partial' ? 'جزئي' : 'غير مدفوع'}
              </span>
            </div>
          ))}
        </section>
      )}
      <p className="text-center text-[10px] text-slate-600 pb-4">عرض فقط — لا يمكن التعديل من هذه الشاشة</p>
    </>
  );
};

export default ParentPortal;
