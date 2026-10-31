// Browser-side PDF helpers (nothing is uploaded: files never leave the device).
// pdf-lib and pdfjs-dist are loaded lazily so they do not weigh on the main bundle.
import { parsePageRanges } from './pageRanges';

export function downloadBytes(bytes: Uint8Array | ArrayBuffer, fileName: string, mime = 'application/pdf') {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const readBytes = async (f: File) => new Uint8Array(await f.arrayBuffer());

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('اختار ملفين PDF على الأقل.');
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await readBytes(f), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export async function pdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(await readBytes(file), { ignoreEncryption: true });
  return doc.getPageCount();
}

/** Extracts the chosen pages (e.g. "1-3, 5") into a new PDF. */
export async function extractPages(file: File, ranges: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(await readBytes(file), { ignoreEncryption: true });
  const idx = parsePageRanges(ranges, src.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

/** One PDF per page, returned as { name, bytes }. */
export async function splitEveryPage(file: File): Promise<{ name: string; bytes: Uint8Array }[]> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(await readBytes(file), { ignoreEncryption: true });
  const base = file.name.replace(/\.pdf$/i, '');
  const result: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const out = await PDFDocument.create();
    const [p] = await out.copyPages(src, [i]);
    out.addPage(p);
    result.push({ name: `${base}-صفحة-${i + 1}.pdf`, bytes: await out.save() });
  }
  return result;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('تعذر معالجة الصورة'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Compress = re-render every page as a JPEG image (the only reliable way in a browser).
 * Text becomes an image (not selectable), so the UI warns the teacher first.
 */
export async function compressPdf(
  file: File,
  level: 'medium' | 'high',
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const pdfjs: any = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  }
  const { PDFDocument } = await import('pdf-lib');
  const task = pdfjs.getDocument({ data: await readBytes(file) });
  const doc = await task.promise;
  const out = await PDFDocument.create();
  const scale = level === 'high' ? 1.0 : 1.4;
  const quality = level === 'high' ? 0.5 : 0.7;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('المتصفح لا يدعم المعالجة المطلوبة.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const jpg = await out.embedJpg(await canvasToJpeg(canvas, quality));
    const p = out.addPage([canvas.width, canvas.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    canvas.width = 0;
    onProgress?.(i, doc.numPages);
  }
  return out.save();
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`تعذر قراءة الصورة: ${file.name}`));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Images (gallery or camera photos) -> one PDF, one image per page, resized to max 1800px. */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('اختار صورة واحدة على الأقل.');
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const img = await loadImage(f);
    const max = 1800;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('المتصفح لا يدعم المعالجة المطلوبة.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const jpg = await out.embedJpg(await canvasToJpeg(canvas, 0.82));
    const page = out.addPage([w, h]);
    page.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
  }
  return out.save();
}
