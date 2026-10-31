import React, { useRef, useState } from 'react';
import {
  compressPdf,
  downloadBytes,
  extractPages,
  formatBytes,
  imagesToPdf,
  mergePdfs,
  pdfPageCount,
  splitEveryPage,
} from '../services/pdfTools';

type Tool = 'merge' | 'split' | 'compress' | 'scan' | 'qr';

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'merge', label: 'دمج PDF', icon: '🧩' },
  { id: 'split', label: 'تقسيم PDF', icon: '✂️' },
  { id: 'compress', label: 'ضغط PDF', icon: '🗜️' },
  { id: 'scan', label: 'مسح ضوئي', icon: '📷' },
  { id: 'qr', label: 'باركود / QR', icon: '🔳' },
];

const btn = 'px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 active:scale-95';
const card = 'rounded-2xl bg-slate-900/70 border border-purple-500/20 p-3.5 space-y-3';

const FileInput: React.FC<{
  accept: string;
  multiple?: boolean;
  capture?: 'environment';
  label: string;
  onFiles: (files: File[]) => void;
}> = ({ accept, multiple, capture, label, onFiles }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = '';
          if (list.length) onFiles(list);
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className={`${btn} bg-purple-600 hover:bg-purple-500 text-white`}>
        {label}
      </button>
    </>
  );
};

export const FileToolsPanel: React.FC = () => {
  const [tool, setTool] = useState<Tool>('merge');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitPages, setSplitPages] = useState(0);
  const [ranges, setRanges] = useState('');
  const [compFile, setCompFile] = useState<File | null>(null);
  const [level, setLevel] = useState<'medium' | 'high'>('medium');
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [qrResult, setQrResult] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || 'حصلت مشكلة، حاول تاني.');
    } finally {
      setBusy(false);
    }
  };

  const moveMerge = (i: number, d: -1 | 1) =>
    setMergeFiles((arr) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return arr;
      const copy = arr.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const readQr = (file: File) =>
    run(async () => {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) throw new Error('المتصفح ده مش بيدعم قراءة الباركود. جرّب Chrome على أندرويد أو اللاب.');
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector().detect(bitmap);
      if (!codes.length) throw new Error('ما لقيتش باركود في الصورة. صوّره أوضح وقرّب.');
      setQrResult(codes.map((c: any) => c.rawValue).join('\n'));
    });

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTool(t.id);
              setErr('');
              setMsg('');
            }}
            className={`${btn} whitespace-nowrap ${tool === t.id ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400">كل المعالجة بتتم على جهازك، الملفات مش بتترفع لأي سيرفر.</p>

      {err && <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-xl p-2.5">{err}</p>}
      {msg && <p className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-2.5">{msg}</p>}

      {tool === 'merge' && (
        <div className={card}>
          <FileInput accept="application/pdf" multiple label="➕ إضافة ملفات PDF" onFiles={(f) => setMergeFiles((a) => [...a, ...f])} />
          {mergeFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-slate-950/60 rounded-xl p-2">
              <span className="flex-1 truncate text-slate-200">{i + 1}. {f.name} <span className="text-slate-500">({formatBytes(f.size)})</span></span>
              <button type="button" onClick={() => moveMerge(i, -1)} className="px-2">⬆️</button>
              <button type="button" onClick={() => moveMerge(i, 1)} className="px-2">⬇️</button>
              <button type="button" onClick={() => setMergeFiles((a) => a.filter((_, k) => k !== i))} className="px-2">✖️</button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy || mergeFiles.length < 2}
            className={`${btn} bg-emerald-600 text-white w-full`}
            onClick={() =>
              run(async () => {
                const bytes = await mergePdfs(mergeFiles);
                downloadBytes(bytes, 'ملف-مدمج.pdf');
                setMsg(`تم الدمج ✅ (${formatBytes(bytes.length)})`);
              })
            }
          >
            {busy ? 'جارٍ الدمج...' : 'دمج وتنزيل'}
          </button>
        </div>
      )}

      {tool === 'split' && (
        <div className={card}>
          <FileInput
            accept="application/pdf"
            label="📄 اختيار ملف PDF"
            onFiles={([f]) =>
              run(async () => {
                setSplitFile(f);
                setSplitPages(await pdfPageCount(f));
              })
            }
          />
          {splitFile && (
            <>
              <p className="text-xs text-slate-300">{splitFile.name} — {splitPages} صفحة</p>
              <input
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="الصفحات المطلوبة، مثال: 1-3, 5"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={`${btn} bg-emerald-600 text-white flex-1`}
                  onClick={() =>
                    run(async () => {
                      const bytes = await extractPages(splitFile, ranges);
                      downloadBytes(bytes, `${splitFile.name.replace(/\.pdf$/i, '')}-مقتطع.pdf`);
                      setMsg('تم استخراج الصفحات ✅');
                    })
                  }
                >
                  استخراج الصفحات
                </button>
                <button
                  type="button"
                  disabled={busy || splitPages > 30}
                  title={splitPages > 30 ? 'أكتر من 30 صفحة: استخدم الاستخراج بالنطاق' : ''}
                  className={`${btn} bg-slate-700 text-white flex-1`}
                  onClick={() =>
                    run(async () => {
                      const parts = await splitEveryPage(splitFile);
                      for (const p of parts) {
                        downloadBytes(p.bytes, p.name);
                        await new Promise((r) => setTimeout(r, 250));
                      }
                      setMsg(`تم تنزيل ${parts.length} ملف ✅`);
                    })
                  }
                >
                  كل صفحة ملف
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tool === 'compress' && (
        <div className={card}>
          <FileInput accept="application/pdf" label="📄 اختيار ملف PDF" onFiles={([f]) => setCompFile(f)} />
          {compFile && (
            <>
              <p className="text-xs text-slate-300">{compFile.name} — {formatBytes(compFile.size)}</p>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setLevel('medium')} className={`${btn} flex-1 ${level === 'medium' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>ضغط متوسط (جودة أعلى)</button>
                <button type="button" onClick={() => setLevel('high')} className={`${btn} flex-1 ${level === 'high' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>ضغط عالي (حجم أقل)</button>
              </div>
              <p className="text-[11px] text-amber-300">تنبيه: الضغط بيحوّل الصفحات لصور، فالنص مش هيبقى قابل للتحديد أو البحث.</p>
              <button
                type="button"
                disabled={busy}
                className={`${btn} bg-emerald-600 text-white w-full`}
                onClick={() =>
                  run(async () => {
                    const bytes = await compressPdf(compFile, level, (d, t) => setMsg(`جارٍ الضغط... ${d}/${t}`));
                    if (bytes.length >= compFile.size) {
                      setMsg(`الملف الأصلي (${formatBytes(compFile.size)}) أصغر أو مساوي، فما فيش فايدة من الضغط.`);
                      return;
                    }
                    downloadBytes(bytes, `${compFile.name.replace(/\.pdf$/i, '')}-مضغوط.pdf`);
                    setMsg(`تم ✅ ${formatBytes(compFile.size)} ← ${formatBytes(bytes.length)}`);
                  })
                }
              >
                {busy ? 'جارٍ الضغط...' : 'ضغط وتنزيل'}
              </button>
            </>
          )}
        </div>
      )}

      {tool === 'scan' && (
        <div className={card}>
          <div className="flex gap-2 flex-wrap">
            <FileInput accept="image/*" capture="environment" label="📷 تصوير صفحة" onFiles={(f) => setScanFiles((a) => [...a, ...f])} />
            <FileInput accept="image/*" multiple label="🖼️ من المعرض" onFiles={(f) => setScanFiles((a) => [...a, ...f])} />
          </div>
          {scanFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-slate-950/60 rounded-xl p-2">
              <span className="flex-1 truncate text-slate-200">صفحة {i + 1}: {f.name}</span>
              <button type="button" onClick={() => setScanFiles((a) => a.filter((_, k) => k !== i))} className="px-2">✖️</button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy || scanFiles.length === 0}
            className={`${btn} bg-emerald-600 text-white w-full`}
            onClick={() =>
              run(async () => {
                const bytes = await imagesToPdf(scanFiles);
                downloadBytes(bytes, 'مسح-ضوئي.pdf');
                setMsg(`تم إنشاء PDF من ${scanFiles.length} صفحة ✅`);
                setScanFiles([]);
              })
            }
          >
            {busy ? 'جارٍ التجهيز...' : 'تحويل لـ PDF وتنزيل'}
          </button>
          <p className="text-[11px] text-slate-500">استخراج النص من الصور (OCR) هيتضاف في مرحلة جاية.</p>
        </div>
      )}

      {tool === 'qr' && (
        <div className={card}>
          <FileInput accept="image/*" capture="environment" label="📷 تصوير باركود / QR" onFiles={([f]) => readQr(f)} />
          {qrResult && (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap break-all text-xs bg-slate-950 rounded-xl p-2.5 text-emerald-200">{qrResult}</pre>
              <div className="flex gap-2">
                <button type="button" className={`${btn} bg-slate-700 text-white`} onClick={() => navigator.clipboard?.writeText(qrResult)}>نسخ</button>
                {/^https?:\/\//i.test(qrResult.trim()) && (
                  <a href={qrResult.trim()} target="_blank" rel="noopener noreferrer" className={`${btn} bg-purple-600 text-white`}>فتح الرابط</a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileToolsPanel;
