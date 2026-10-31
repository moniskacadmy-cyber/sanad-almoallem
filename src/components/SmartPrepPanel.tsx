import React, { useState } from 'react';
import type { LibraryItemType, TeacherProfile } from '../types';
import { addLibraryItem } from '../firebase';
import { getAuthenticatedHeaders } from '../services/authHelper';
import { extractPdfText } from '../services/pdfTools';

type Mode =
  | 'handout_explain' | 'handout_review' | 'handout_exam_night' | 'handout_unit_summary'
  | 'formatter' | 'lesson_studio' | 'exam_paper' | 'exam_electronic' | 'video_script';

const MODES: { id: Mode; label: string; icon: string; libType: LibraryItemType; exam?: boolean }[] = [
  { id: 'handout_explain', label: 'ملزمة شرح', icon: '📘', libType: 'lesson_plan' },
  { id: 'handout_review', label: 'ملزمة مراجعة', icon: '🔁', libType: 'summary' },
  { id: 'handout_exam_night', label: 'ليلة الامتحان', icon: '🌙', libType: 'summary' },
  { id: 'handout_unit_summary', label: 'ملخص وحدة', icon: '🗂️', libType: 'summary' },
  { id: 'formatter', label: 'منسق الملازم', icon: '🧹', libType: 'lesson_plan' },
  { id: 'lesson_studio', label: 'استوديو الدرس', icon: '🎬', libType: 'lesson_plan' },
  { id: 'exam_paper', label: 'امتحان ورقي', icon: '🖨️', libType: 'quiz', exam: true },
  { id: 'exam_electronic', label: 'امتحان إلكتروني', icon: '💻', libType: 'quiz', exam: true },
  { id: 'video_script', label: 'سيناريو فيديو', icon: '🎥', libType: 'lesson_plan' },
];

interface QuizQ { q: string; options: string[]; answer: number; explain: string }

const field = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white';
const btn = 'px-3 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 active:scale-95 transition';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

export const SmartPrepPanel: React.FC<{ profile: TeacherProfile }> = ({ profile }) => {
  const [mode, setMode] = useState<Mode>('handout_explain');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState(10);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState('');
  const [quiz, setQuiz] = useState<QuizQ[] | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState(false);

  const cur = MODES.find((m) => m.id === mode)!;

  const readFile = async (f: File) => {
    setErr('');
    try {
      if (/\.pdf$/i.test(f.name)) {
        const t = await extractPdfText(f);
        if (!t) throw new Error('الملف ده صور (مسح ضوئي) ومفيهوش نص. الصق النص بنفسك.');
        setText(t);
      } else if (/\.(txt|md)$/i.test(f.name)) {
        setText((await f.text()).slice(0, 12000));
      } else {
        throw new Error('الملفات المدعومة: PDF (نصي) أو TXT. ملفات Word: انسخي النص والصقيه.');
      }
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const generate = async () => {
    setBusy(true);
    setErr('');
    setNote('');
    setAnswer('');
    setQuiz(null);
    setPicked({});
    setSaved(false);
    try {
      const headers = await getAuthenticatedHeaders();
      const res = await fetch('/api/ai/prepare', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, topic, grade, difficulty, count, text, subject: profile.subject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر إنشاء التحضير.');
      if (data.quiz) setQuiz(data.quiz);
      else setAnswer(data.answer || '');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const hasResult = !!answer || !!quiz;
  const plainResult = () =>
    quiz
      ? quiz.map((q, i) => `${i + 1}. ${q.q}\n${q.options.map((o, k) => `   ${'أبجدهو'[k] || k + 1}) ${o}`).join('\n')}\nالإجابة: ${'أبجدهو'[q.answer]}${q.explain ? ` — ${q.explain}` : ''}`).join('\n\n')
      : answer;

  const save = async () => {
    try {
      const title = `${cur.icon} ${cur.label}: ${topic || 'بدون عنوان'}`.slice(0, 190);
      const content = (quiz ? `QUIZ_JSON:${JSON.stringify(quiz)}` : answer).slice(0, 59000);
      await addLibraryItem(profile.id, { title, type: cur.libType, subject: profile.subject || 'عام', content } as any);
      setSaved(true);
      setNote('تم الحفظ في مكتبتي ✅');
    } catch (e: any) {
      setErr(e?.message || 'تعذر الحفظ.');
    }
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return setErr('المتصفح منع نافذة الطباعة. اسمحي بالنوافذ المنبثقة.');
    w.document.write(
      `<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(topic || cur.label)}</title><style>body{font-family:Tahoma,Arial,sans-serif;line-height:1.9;padding:24px;white-space:pre-wrap}</style></head><body>${esc(plainResult())}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  const score = quiz ? quiz.reduce((s, q, i) => s + (picked[i] === q.answer ? 1 : 0), 0) : 0;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => setMode(m.id)}
            className={`${btn} ${mode === m.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
            <div className="text-base">{m.icon}</div>{m.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-900/70 border border-purple-500/20 p-3.5 space-y-2.5">
        <input className={field} placeholder="موضوع / عنوان الدرس" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <input className={field} placeholder="الصف / المرحلة (مثال: الصف الثالث الإعدادي)" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <div className="flex gap-2">
          {cur.exam && (
            <select className={field} value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
              <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
            </select>
          )}
          <input className={field} type="number" min={3} max={30} value={count} onChange={(e) => setCount(Number(e.target.value) || 10)} title="عدد الأسئلة" />
        </div>
        <textarea className={field} rows={5} maxLength={12000} placeholder={mode === 'formatter' ? 'الصق النص المراد تنسيقه' : 'الصق نص الدرس (اختياري لو كتبتي الموضوع)'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center gap-2">
          <label className={`${btn} bg-slate-800 text-slate-200`}>
            📎 رفع PDF / TXT
            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readFile(f); }} />
          </label>
          <span className="text-[10px] text-slate-500">{text.length}/12000</span>
        </div>
        <button type="button" disabled={busy} onClick={generate} className={`${btn} w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white`}>
          {busy ? 'جارٍ الإعداد... (ممكن ياخد دقيقة)' : `✨ إنشاء ${cur.label}`}
        </button>
      </div>

      {err && <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-xl p-2.5">{err}</p>}
      {note && <p className="text-xs text-emerald-300">{note}</p>}

      {hasResult && (
        <div className="rounded-2xl bg-slate-900/70 border border-emerald-500/25 p-3.5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} bg-slate-700 text-white`} onClick={() => navigator.clipboard?.writeText(plainResult())}>نسخ</button>
            <button type="button" className={`${btn} bg-slate-700 text-white`} onClick={print}>🖨️ طباعة</button>
            <button type="button" disabled={saved} className={`${btn} bg-emerald-600 text-white`} onClick={save}>{saved ? 'تم الحفظ' : '💾 حفظ في مكتبتي'}</button>
          </div>
          {quiz ? (
            <div className="space-y-3">
              {quiz.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-bold">{i + 1}. {q.q}</p>
                  {q.options.map((o, k) => {
                    const chosen = picked[i] !== undefined;
                    const right = k === q.answer;
                    return (
                      <button key={k} type="button" disabled={chosen} onClick={() => setPicked({ ...picked, [i]: k })}
                        className={`block w-full text-right text-xs rounded-xl px-3 py-2 border ${chosen && right ? 'bg-emerald-900/60 border-emerald-500' : chosen && picked[i] === k ? 'bg-rose-900/60 border-rose-500' : 'bg-slate-950 border-slate-700'}`}>
                        {o}
                      </button>
                    );
                  })}
                  {picked[i] !== undefined && q.explain && <p className="text-[11px] text-slate-400">💡 {q.explain}</p>}
                </div>
              ))}
              <p className="text-sm font-bold text-amber-200">النتيجة: {score} / {quiz.length}</p>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100 select-text">{answer}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartPrepPanel;
