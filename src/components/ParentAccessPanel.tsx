import React, { useCallback, useEffect, useState } from 'react';
import { Student, LibraryItem } from '../types';
import { subscribeToLibrary, updateLibraryItem } from '../firebase';
import {
  ParentLinkInfo,
  createParentLink,
  getParentLink,
  getParentSettings,
  revokeParentLink,
  setParentShowFinance,
} from '../services/parentApi';

interface Props {
  teacherId: string;
  teacherName?: string;
  student: Student;
}

/** لوحة المعلم: إنشاء كود/رابط ولي الأمر (قراءة فقط) وإلغاؤه، وإظهار الرصيد، واختيار المذكرات اللي تظهر له. */
export const ParentAccessPanel: React.FC<Props> = ({ teacherId, teacherName, student }) => {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<ParentLinkInfo | null>(null);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showFinance, setShowFinance] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  const load = useCallback(async () => {
    try {
      setLink(await getParentLink(student.id));
      setShowFinance((await getParentSettings()).showFinance);
    } catch (e: any) {
      setMsg(e?.message || 'تعذر التحميل.');
    }
  }, [student.id]);

  useEffect(() => {
    if (!open) return;
    void load();
    const unsub = subscribeToLibrary(teacherId, setLibrary);
    return () => unsub();
  }, [open, load, teacherId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e: any) {
      setMsg(e?.message || 'حدث خطأ.');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      if (link && !window.confirm('إنشاء كود جديد سيوقف الكود الحالي فورًا. متابعة؟')) return;
      setLink(await createParentLink(student.id, days));
      setMsg('تم إنشاء الكود ✅');
    });

  const revoke = () =>
    run(async () => {
      if (!window.confirm('سيتم قفل دخول ولي الأمر فورًا. متابعة؟')) return;
      await revokeParentLink(student.id);
      setLink(null);
      setMsg('تم إلغاء الكود، الدخول مقفول الآن.');
    });

  const copy = () =>
    run(async () => {
      if (!link) return;
      await navigator.clipboard.writeText(link.url);
      setMsg('تم نسخ الرابط ✅');
    });

  const shareWhatsApp = () => {
    if (!link) return;
    const text = `السلام عليكم 🌸\nرابط متابعة الطالب/ة ${student.name} (حضور، حصص قادمة، مذكرات):\n${link.url}\n\nالرابط للقراءة فقط وخاص بكم.\nمع تحيات: أستاذ ${teacherName || ''}`;
    const phone = String(student.parentPhone || student.phone || '').replace(/\D/g, '');
    window.open(
      phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const toggleFinance = () =>
    run(async () => {
      const next = !showFinance;
      await setParentShowFinance(next);
      setShowFinance(next);
    });

  const toggleShared = (item: LibraryItem) =>
    run(async () => {
      const cur = item.sharedWithStudentIds || [];
      const next = cur.includes(student.id) ? cur.filter((x) => x !== student.id) : [...cur, student.id];
      await updateLibraryItem(teacherId, item.id, { sharedWithStudentIds: next });
    });

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-emerald-500/25 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-3.5 flex items-center justify-between text-right cursor-pointer"
      >
        <span className="text-xs font-bold text-white">👨‍👩‍👧 حساب ولي الأمر (قراءة فقط)</span>
        <span className="text-[10px] text-slate-400">{open ? 'إخفاء' : 'عرض'}</span>
      </button>

      {open && (
        <div className="p-3.5 pt-0 space-y-3 text-xs text-slate-200">
          {link ? (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5 space-y-2">
              <div className="text-[11px] text-slate-400">
                ينتهي: {new Date(link.expiresAtMs).toLocaleDateString('ar-EG')}
              </div>
              <div className="break-all font-mono text-[10px] text-emerald-300 select-all">{link.url}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={copy} className="px-3 py-1.5 rounded-lg bg-slate-700 font-bold">نسخ الرابط</button>
                <button type="button" onClick={shareWhatsApp} className="px-3 py-1.5 rounded-lg bg-emerald-600 font-bold">إرسال واتساب</button>
                <button type="button" disabled={busy} onClick={revoke} className="px-3 py-1.5 rounded-lg bg-rose-600 font-bold">إلغاء الكود</button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">لا يوجد كود فعّال لهذا الطالب.</p>
          )}

          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5"
            >
              <option value={30}>صلاحية 30 يوم</option>
              <option value={90}>صلاحية 90 يوم</option>
              <option value={180}>صلاحية 180 يوم</option>
              <option value={365}>صلاحية سنة</option>
            </select>
            <button type="button" disabled={busy} onClick={create} className="px-3 py-1.5 rounded-lg bg-purple-600 font-bold">
              {link ? 'كود جديد (يلغي القديم)' : 'إنشاء كود ولي أمر'}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showFinance} disabled={busy} onChange={toggleFinance} />
            <span>إظهار حالة الاشتراك والرصيد لأولياء الأمور (ينطبق على كل الطلاب)</span>
          </label>

          <div>
            <div className="text-[11px] text-slate-400 mb-1">المذكرات والفيديوهات اللي تظهر لولي أمر {student.name}:</div>
            {library.length === 0 ? (
              <p className="text-[11px] text-slate-500">المكتبة فاضية.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {library.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={(item.sharedWithStudentIds || []).includes(student.id)}
                      onChange={() => toggleShared(item)}
                    />
                    <span className="truncate">{item.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {msg && <div className="text-[11px] text-amber-300">{msg}</div>}
        </div>
      )}
    </div>
  );
};
