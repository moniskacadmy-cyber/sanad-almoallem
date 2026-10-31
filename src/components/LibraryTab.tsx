import React, { useState } from 'react';
const FileToolsPanel = React.lazy(() => import('./FileToolsPanel'));
const SmartPrepPanel = React.lazy(() => import('./SmartPrepPanel'));
import { TeacherProfile, LibraryItem, LibraryItemType } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { useBackHandler } from '../services/backHandler';
import {
  auth,
  addLibraryItem,
  deleteLibraryItem,
  seedDefaultLibraryItems,
  cleanUndefined,
} from '../firebase';
import {
  BookOpen,
  Plus,
  Copy,
  Check,
  Trash2,
  X,
  FileText,
  Sparkles,
  MessageCircle,
  Upload,
  FileUp,
  Image as ImageIcon,
  File,
  Eye,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Download,
  Printer,
  Cloud,
  Wrench,
  GraduationCap,
} from 'lucide-react';

export function exportToWord(title: string, content: string, subject?: string, teacherName?: string) {
  const dateStr = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(new Date());
  const headerHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, Tahoma, sans-serif; direction: rtl; text-align: right; padding: 30px; line-height: 1.8; color: #1e293b; background-color: #ffffff; }
        h1 { color: #6d28d9; font-size: 20pt; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; margin-bottom: 12px; }
        .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 11pt; color: #475569; }
        .meta-item { display: inline-block; margin-left: 20px; }
        .content { font-size: 13pt; white-space: pre-wrap; line-height: 1.9; margin-top: 15px; }
        .footer { margin-top: 35px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 10pt; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body dir="rtl">
      <h1>${title}</h1>
      <div class="meta-box">
        ${subject ? `<span class="meta-item"><strong>المادة:</strong> ${subject}</span>` : ''}
        ${teacherName ? `<span class="meta-item"><strong>المعلم:</strong> أ. ${teacherName}</span>` : ''}
        <span class="meta-item"><strong>التاريخ:</strong> ${dateStr}</span>
      </div>
      <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
      <div class="footer">تم التصدير من منصة سند المعلم - Sanad Al-Moallem | منصة المعلم الذكية</div>
    </body>
    </html>
  `;
  const blob = new Blob(['\ufeff' + headerHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPrintPdf(title: string, content: string, subject?: string, teacherName?: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة المستند أو تصديره إلى PDF');
    return;
  }
  const dateStr = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(new Date());
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 35px; line-height: 1.8; color: #0f172a; }
        .header { border-bottom: 2.5px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { color: #6d28d9; margin: 0 0 10px 0; font-size: 22px; font-weight: 800; }
        .meta { font-size: 13px; color: #475569; display: flex; gap: 24px; margin-top: 8px; }
        .content { font-size: 14px; white-space: pre-wrap; line-height: 2; margin-top: 20px; }
        .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print {
          body { padding: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          ${subject ? `<span><strong>المادة:</strong> ${subject}</span>` : ''}
          ${teacherName ? `<span><strong>المعلم:</strong> أ. ${teacherName}</span>` : ''}
          <span><strong>التاريخ:</strong> ${dateStr}</span>
        </div>
      </div>
      <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <div class="footer">تم التصدير بواسطة منصة سند المعلم - Sanad Al-Moallem</div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function extractTextFromPdf(file: File): Promise<{ text: string; isScanned: boolean }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions.workerSrc) {
      try {
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
      } catch (_) {}
    }
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      if (pageText.trim()) {
        fullText += `[صفحة ${i}]:\n${pageText}\n\n`;
      }
      if (fullText.length >= 30000) {
        fullText = fullText.slice(0, 30000);
        break;
      }
    }
    const trimmed = fullText.trim();
    if (!trimmed) {
      return {
        text: `ملف PDF: ${file.name}\n(تنبيه: ملف الـ PDF ممسوح ضوئياً أو عبارة عن صور فقط ولا يحتوي على نصوص قابلة للقراءة الآلية. يرجى كتابة ملخص يدوي لأهم النقاط).`,
        isScanned: true,
      };
    }
    return { text: trimmed, isScanned: false };
  } catch (error) {
    console.warn('PDF text extraction error:', error);
    return {
      text: `ملف PDF: ${file.name}\n(تعذر استخراج النص تلقائياً من الملف، يرجى كتابة الملخص أو الملاحظات يدوياً).`,
      isScanned: true,
    };
  }
}

async function compressImage(file: File): Promise<{ base64: string; sizeKB: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const approxBytes = Math.floor((dataUrl.length * 3) / 4);
        const sizeKB = Math.round(approxBytes / 1024);
        resolve({ base64: dataUrl, sizeKB });
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

interface LibraryTabProps {
  profile: TeacherProfile;
  libraryItems: LibraryItem[];
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ profile, libraryItems }) => {
  // Tab view: Sources & AI vs Templates
  const [activeSection, setActiveSection] = useState<'sources_ai' | 'templates' | 'file_tools' | 'smart_prep'>('sources_ai');

  // AI Assistant State
  const [question, setQuestion] = useState('');
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  // Sources Modal State
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceType, setSourceType] = useState<LibraryItemType>('pdf');
  const [sourceSubject, setSourceSubject] = useState(profile.subject || 'عام');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceFileSize, setSourceFileSize] = useState('');
  const [sourceFileData, setSourceFileData] = useState<string | undefined>(undefined);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfWarningNotice, setPdfWarningNotice] = useState<string | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  // Preview Modal
  const [previewingSource, setPreviewingSource] = useState<LibraryItem | null>(null);

  // Templates Management State
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<LibraryItem | null>(null);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'lesson_plan' | 'quiz' | 'summary'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Lesson Prep Modal State (Edit Before Send Modal)
  const [showCreateLessonPrepModal, setShowCreateLessonPrepModal] = useState(false);
  const [prepModalTopic, setPrepModalTopic] = useState('');
  const [prepModalGrade, setPrepModalGrade] = useState('');
  const [prepModalContent, setPrepModalContent] = useState('');
  const [prepModalRecipientPhone, setPrepModalRecipientPhone] = useState('');
  const [isSavingPrepModal, setIsSavingPrepModal] = useState(false);
  const [copiedPrepModal, setCopiedPrepModal] = useState(false);
  const [prepModalSuccessMsg, setPrepModalSuccessMsg] = useState(false);

  // Search Bar State
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-Save Cloud Status State
  const [cloudStatus, setCloudStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Register modals on back handler stack
  useBackHandler(showAddSourceModal, () => setShowAddSourceModal(false), 'library_add_source_modal');
  useBackHandler(!!previewingSource, () => setPreviewingSource(null), 'library_preview_source');
  useBackHandler(showAddTemplateModal, () => setShowAddTemplateModal(false), 'library_add_template_modal');
  useBackHandler(!!viewingItem, () => setViewingItem(null), 'library_viewing_item');
  useBackHandler(showCreateLessonPrepModal, () => setShowCreateLessonPrepModal(false), 'library_create_lesson_prep_modal');

  // Filter items into sources vs templates and apply instant search
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sources = libraryItems.filter(
    (item) => item.type === 'pdf' || item.type === 'image' || item.type === 'book'
  );

  const filteredSources = sources.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      (item.title && item.title.toLowerCase().includes(normalizedQuery)) ||
      (item.subject && item.subject.toLowerCase().includes(normalizedQuery)) ||
      (item.fileName && item.fileName.toLowerCase().includes(normalizedQuery)) ||
      (item.content && item.content.toLowerCase().includes(normalizedQuery))
    );
  });

  const templates = libraryItems.filter(
    (item) => item.type === 'lesson_plan' || item.type === 'quiz' || item.type === 'summary'
  );

  const filteredTemplates = templates.filter((t) => {
    if (templateFilter !== 'all' && t.type !== templateFilter) return false;
    if (!normalizedQuery) return true;
    return (
      (t.title && t.title.toLowerCase().includes(normalizedQuery)) ||
      (t.subject && t.subject.toLowerCase().includes(normalizedQuery)) ||
      (t.content && t.content.toLowerCase().includes(normalizedQuery))
    );
  });

  // Handle Ask Gemini AI
  const handleAskAI = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || question).trim();
    if (!promptToSend || isAskingAI) return;

    if (customPrompt) {
      setQuestion(customPrompt);
    }

    setIsAskingAI(true);
    setAiError(null);
    setAiAnswer(null);

    try {
      // Gather context from all uploaded teacher sources
      const sourcesContext = sources.map((s) => ({
        title: s.title,
        type: s.type === 'pdf' ? 'كتاب / ملف PDF' : s.type === 'image' ? 'صورة منهج' : 'مرجع تدريس',
        content: s.content || s.title,
      }));

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: promptToSend,
          teacherName: profile.name,
          subject: profile.subject,
          sources: sourcesContext,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل في استلام الإجابة من الذكاء الاصطناعي');
      }

      if (res.headers.get('Content-Type')?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let buffer = '';

        setAiAnswer('');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                setAiAnswer(accumulated);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (_) {}
          }
        }
      } else {
        const data = await res.json();
        setAiAnswer(data.answer);
      }
    } catch (err: any) {
      console.error('Error asking AI:', err);
      setAiError(err.message || 'حدث خطأ أثناء التواصل مع نموذج الذكاء الاصطناعي.');
    } finally {
      setIsAskingAI(false);
    }
  };

  // Copy AI response
  const handleCopyAnswer = () => {
    if (!aiAnswer) return;
    navigator.clipboard.writeText(aiAnswer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  // Share AI response to WhatsApp
  const handleShareAnswerWhatsApp = () => {
    if (!aiAnswer) return;
    const text = encodeURIComponent(`*سؤال المعلم:*\n${question}\n\n*إجابة المساعد الذكي (سند المعلم):*\n\n${aiAnswer}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Handle File Upload for Sources (PDF or Images)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploadError(null);
    setPdfWarningNotice(null);

    const sizeInKB = Math.round(file.size / 1024);
    const sizeStr = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`;

    setSourceFileName(file.name);
    setSourceFileSize(sizeStr);

    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    if (file.type.includes('pdf')) {
      setSourceType('pdf');
      setIsExtractingPdf(true);
      try {
        const { text, isScanned } = await extractTextFromPdf(file);
        setSourceContent(text);
        if (isScanned) {
          setPdfWarningNotice('تنبيه: ملف الـ PDF ممسوح ضوئياً أو لا يحتوي على نصوص قابلة للقراءة الآلية. يمكنك كتابة ملخص يدوي لأهم محتوياته.');
        }
      } catch (err: any) {
        console.warn('PDF parse error:', err);
        setSourceContent(`ملف PDF: ${file.name}`);
      } finally {
        setIsExtractingPdf(false);
      }
    } else if (file.type.startsWith('image/')) {
      setSourceType('image');
      try {
        const compressed = await compressImage(file);
        if (!compressed) {
          setFileUploadError('تعذر قراءة ملف الصورة المحدد.');
          return;
        }
        if (compressed.sizeKB > 700) {
          setFileUploadError(`حجم الصورة بعد الضغط (${compressed.sizeKB} KB) يتجاوز الحد الأقصى المسموح به (700 KB). يرجى اختيار صورة أصغر.`);
          setSourceFileData(undefined);
          return;
        }
        setSourceFileData(compressed.base64);
        setSourceFileSize(`${compressed.sizeKB} KB`);
        if (!sourceContent) {
          setSourceContent(`صورة لدرس / صفحة من المنهج: ${file.name}`);
        }
      } catch (err: any) {
        console.error('Image compression error:', err);
        setFileUploadError('حدث خطأ أثناء معالجة وضغط الصورة.');
      }
    }
  };

  // Save new Source
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceTitle.trim()) return;

    setIsSavingSource(true);
    setCloudStatus('saving');
    try {
      await addLibraryItem(profile.id, cleanUndefined({
        title: sourceTitle.trim(),
        type: sourceType,
        subject: sourceSubject.trim(),
        content: sourceContent.trim() || `مصدر تعليمي: ${sourceTitle.trim()}`,
        fileName: sourceFileName.trim() || undefined,
        fileSize: sourceFileSize.trim() || undefined,
        fileData: sourceFileData || undefined,
      }));

      setCloudStatus('saved');
      setTimeout(() => setCloudStatus('idle'), 3000);
      setShowAddSourceModal(false);
      setSourceTitle('');
      setSourceContent('');
      setSourceFileName('');
      setSourceFileSize('');
      setSourceFileData(undefined);
    } catch (err) {
      console.error('Error saving source:', err);
      setCloudStatus('idle');
    } finally {
      setIsSavingSource(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف "${name}"؟`)) {
      try {
        await deleteLibraryItem(profile.id, id);
        if (previewingSource?.id === id) setPreviewingSource(null);
        if (viewingItem?.id === id) setViewingItem(null);
      } catch (err) {
        console.error('Error deleting library item:', err);
      }
    }
  };

  // Seed default templates
  const handleRestoreDefaults = async () => {
    if (window.confirm('هل تريد إضافة النماذج المقترحة الافتراضية إلى مكتبتك؟')) {
      await seedDefaultLibraryItems(profile.id);
    }
  };

  // Generate Lesson Prep Text
  const generateNewLessonPrepText = (topic?: string, grade?: string) => {
    const t = topic !== undefined ? topic : prepModalTopic.trim() || 'عنوان الدرس الجديد';
    const g = grade !== undefined ? grade : prepModalGrade.trim() || 'المرحلة الدراسية';
    const dateFormatted = new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    return (
      `السلام عليكم ورحمة الله وبركاته 🌷\n` +
      `📋 بطاقة تحضير وخطة الحصة الدراسية\n\n` +
      `📚 المادة: ${profile.subject}\n` +
      `👨‍🏫 إعداد المعلم: أ. ${profile.name}\n` +
      `🎯 عنوان الدرس: ${t}\n` +
      `🏫 الصف / المرحلة: ${g}\n` +
      `📅 التاريخ: ${dateFormatted}\n\n` +
      `1️⃣ الأهداف التعليمية:\n` +
      `• استيعاب المفاهيم والمصطلحات الأساسية لدرس (${t}).\n` +
      `• التدرب على حل أمثلة ونماذج تطبيقية متنوعة.\n` +
      `• التأكد من إتقان الطلاب للمهارات المستهدفة.\n\n` +
      `2️⃣ خطة سير الحصة وتوزيع الوقت:\n` +
      `• التهيئة والمراجعة السريعة (5 إلى 10 دقائق).\n` +
      `• الشرح التفاعلي وطرح الأمثلة (25 دقيقة).\n` +
      `• التطبيق العملي والتقويم الفوري (15 دقيقة).\n\n` +
      `3️⃣ الواجب المنزلي والتكليفات:\n` +
      `• حل التدريبات المحددة ومراجعة الملاحظات.\n\n` +
      `مع خالص تمنياتنا لجميع طلابنا بالتفوق والتميز 🌟`
    );
  };

  const handleOpenCreateLessonPrep = (initialTopic?: string) => {
    const t = initialTopic || '';
    setPrepModalTopic(t);
    setPrepModalGrade('');
    setPrepModalRecipientPhone('');
    setPrepModalContent(generateNewLessonPrepText(t, ''));
    setShowCreateLessonPrepModal(true);
  };

  const handleSendPrepWhatsApp = () => {
    const textToSend = prepModalContent || generateNewLessonPrepText();
    const cleanPhone = prepModalRecipientPhone ? prepModalRecipientPhone.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone) : '';
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(textToSend)}`
      : `https://wa.me/?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank');
  };

  const handleCopyPrepModal = () => {
    const textToCopy = prepModalContent || generateNewLessonPrepText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedPrepModal(true);
    setTimeout(() => setCopiedPrepModal(false), 2000);
  };

  const handleSavePrepModalToLibrary = async () => {
    if (!prepModalContent.trim()) return;
    setIsSavingPrepModal(true);
    setCloudStatus('saving');
    try {
      await addLibraryItem(profile.id, cleanUndefined({
        title: `تحضير: ${prepModalTopic.trim() || 'درس جديد'} (${profile.subject})`,
        type: 'lesson_plan',
        subject: profile.subject,
        content: prepModalContent.trim(),
      }));
      setCloudStatus('saved');
      setTimeout(() => setCloudStatus('idle'), 3000);
      setPrepModalSuccessMsg(true);
      setTimeout(() => {
        setPrepModalSuccessMsg(false);
        setShowCreateLessonPrepModal(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving lesson prep:', err);
      setCloudStatus('idle');
    } finally {
      setIsSavingPrepModal(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Top Header with Title and Auto-Save Cloud Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white tracking-wide">
              مكتبتي التعليمية
            </h2>
            {cloudStatus === 'saving' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>جارٍ الحفظ في السحابة...</span>
              </span>
            )}
            {cloudStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                <Cloud className="w-3 h-3 text-emerald-400" />
                <span>متصل بالسحابة ☁️</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            المساعد الذكي لمناهجك، مستودع المراجع والكتب، والتحضيرات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenCreateLessonPrep()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-950/40 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء تحضير جديد 📝</span>
          </button>
        </div>
      </div>

      {/* Grid Cards Layout for Library Sections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Card 1: المساعد الذكي والمصادر */}
        <div
          onClick={() => setActiveSection('sources_ai')}
          className={`rounded-2xl p-3.5 border transition cursor-pointer space-y-1.5 active:scale-95 ${
            activeSection === 'sources_ai'
              ? 'bg-gradient-to-br from-purple-900/90 via-purple-950 to-indigo-950 border-purple-400 text-white shadow-lg shadow-purple-950/60 ring-2 ring-purple-400/40'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-purple-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <Sparkles className={`w-5 h-5 ${activeSection === 'sources_ai' ? 'text-amber-300 animate-pulse' : 'text-purple-400'}`} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-200 border border-purple-500/30">
              {sources.length} مصادر
            </span>
          </div>
          <h3 className="text-xs font-black text-white">المساعد الذكي والمصادر</h3>
          <p className="text-[10px] opacity-80 leading-tight">أسئلة الـ AI والاستناد للمناهج المرفوعة 📚</p>
        </div>

        {/* Card 2: نماذج التحضير والاختبارات */}
        <div
          onClick={() => setActiveSection('templates')}
          className={`rounded-2xl p-3.5 border transition cursor-pointer space-y-1.5 active:scale-95 ${
            activeSection === 'templates'
              ? 'bg-gradient-to-br from-purple-900/90 via-purple-950 to-indigo-950 border-purple-400 text-white shadow-lg shadow-purple-950/60 ring-2 ring-purple-400/40'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-purple-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <FileText className={`w-5 h-5 ${activeSection === 'templates' ? 'text-amber-300' : 'text-indigo-400'}`} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-200 border border-indigo-500/30">
              {templates.length} قوالب
            </span>
          </div>
          <h3 className="text-xs font-black text-white">نماذج التحضير والاختبارات</h3>
          <p className="text-[10px] opacity-80 leading-tight">نماذج التحضير الجاهزة والاختبارات 📝</p>
        </div>

        {/* Card 3: أدوات الملفات */}
        <div
          onClick={() => setActiveSection('file_tools')}
          className={`rounded-2xl p-3.5 border transition cursor-pointer space-y-1.5 active:scale-95 ${
            activeSection === 'file_tools'
              ? 'bg-gradient-to-br from-purple-900/90 via-purple-950 to-indigo-950 border-purple-400 text-white shadow-lg shadow-purple-950/60 ring-2 ring-purple-400/40'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-purple-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <Wrench className={`w-5 h-5 ${activeSection === 'file_tools' ? 'text-amber-300' : 'text-teal-400'}`} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-200 border border-teal-500/30">
              تفريغ وتنسيق
            </span>
          </div>
          <h3 className="text-xs font-black text-white">أدوات الملفات</h3>
          <p className="text-[10px] opacity-80 leading-tight">تفريغ وتحويل المستندات والملفات 🛠️</p>
        </div>

        {/* Card 4: التحضير الذكي */}
        <div
          onClick={() => setActiveSection('smart_prep')}
          className={`rounded-2xl p-3.5 border transition cursor-pointer space-y-1.5 active:scale-95 ${
            activeSection === 'smart_prep'
              ? 'bg-gradient-to-br from-purple-900/90 via-purple-950 to-indigo-950 border-purple-400 text-white shadow-lg shadow-purple-950/60 ring-2 ring-purple-400/40'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-purple-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <GraduationCap className={`w-5 h-5 ${activeSection === 'smart_prep' ? 'text-amber-300' : 'text-amber-400'}`} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-200 border border-amber-500/30">
              توليد AI
            </span>
          </div>
          <h3 className="text-xs font-black text-white">التحضير الذكي الشامل</h3>
          <p className="text-[10px] opacity-80 leading-tight">صناعة خطة درس متكاملة بالذكاء الاصطناعي ✨</p>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث سريع في كتب المناهج، المصادر، ونماذج التحضيرات..."
          className="w-full rounded-2xl bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-2.5 text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* SECTION 1: AI ASSISTANT & SOURCES (Default & Main View) */}
      {activeSection === 'sources_ai' && (
        <div className="space-y-4">
          {/* CARD: ✨ اسأل مصادرك (AI Assistant / Ask Library) */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/35 p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-amber-300 flex items-center justify-center border border-purple-400/30 shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>✨ اسأل مصادرك</span>
                  </h3>
                  <p className="text-[11px] text-purple-200/80">
                    مساعد تدريس ذكي يستند إلى كتبك ومناهجك المرفوعة
                  </p>
                </div>
              </div>

              {sources.length > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                  📚 متصل بـ {sources.length} مصادر
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  إجابات عامة بدون مصادر
                </span>
              )}
            </div>

            {/* Question Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-300">اكتب سؤالك أو استخدم الإدخال الصوتي:</span>
                <VoiceInputButton
                  onTranscript={(transcript) =>
                    setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript))
                  }
                  compact
                />
              </div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="مثلاً: اشرح لي الفرق بين present perfect و past simple بطريقة مناسبة لطالب مستوى A2"
                rows={3}
                className="w-full rounded-2xl bg-slate-950/90 border border-purple-500/30 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 leading-relaxed"
              />

              {/* Quick Question Chips */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  '💡 اشرح قاعدة بطريقة مبسطة',
                  '📝 اقترح 5 أسئلة تدريبية مع الإجابة',
                  '⏱️ خطة درس لمدة 45 دقيقة',
                  '🎯 نشاط صفي تفاعلي ممتع',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      const baseQuestion = chip.replace(/^[^\s]+\s/, '');
                      setQuestion(`${baseQuestion} لطلابي في مادة ${profile.subject}: `);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-purple-200 transition cursor-pointer text-[10px]"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={!question.trim() || isAskingAI}
                onClick={() => handleAskAI()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-purple-950/50 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isAskingAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ تحليل المصادر والتفكير...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>اسأل</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {aiError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{aiError}</span>
              </div>
            )}

            {/* AI Answer Box */}
            {aiAnswer && (
              <div className="rounded-2xl bg-slate-950 border border-purple-500/40 p-3.5 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-purple-900/40 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>إجابة المساعد الذكي:</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyAnswer}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                    >
                      {copiedAnswer ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => exportToWord('إجابة المساعد الذكي', aiAnswer, profile.subject, profile.name)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/80 border border-blue-500/40 hover:bg-blue-900 text-blue-300 text-[10px] font-semibold transition cursor-pointer"
                      title="تصدير إلى ملف Word (.doc)"
                    >
                      <Download className="w-3 h-3" />
                      <span>Word</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportToPrintPdf('إجابة المساعد الذكي', aiAnswer, profile.subject, profile.name)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 hover:bg-rose-900 text-rose-300 text-[10px] font-semibold transition cursor-pointer"
                      title="طباعة / تصدير PDF"
                    >
                      <Printer className="w-3 h-3" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareAnswerWhatsApp}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 hover:bg-emerald-900 text-emerald-300 text-[10px] font-semibold transition cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>واتساب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiAnswer(null)}
                      className="p-1 rounded-lg text-slate-500 hover:text-white transition cursor-pointer"
                      title="مسح الإجابة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed space-y-2 select-text font-sans">
                  {aiAnswer}
                </div>

                {sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] text-purple-300/80 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>تم تضمين {sources.length} من مصادرك وكتبك المرفوعة في صياغة الإجابة.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD: مصادر التدريس الخاصة بك (Sources Section) */}
          <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>مصادر التدريس الخاصة بك</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30">
                    {filteredSources.length} مصادر
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ملفات PDF وصور ومناهج يعتمد عليها الذكاء الاصطناعي في إجاباته
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSourceTitle('');
                  setSourceContent('');
                  setSourceFileName('');
                  setSourceFileSize('');
                  setSourceFileData(undefined);
                  setSourceType('pdf');
                  setShowAddSourceModal(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-purple-950/50 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إضافة مصدر</span>
              </button>
            </div>

            {/* Sources List */}
            {filteredSources.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/50 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                  <FileUp className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-white">
                  {searchQuery ? 'لا توجد نتائج بحث مطابقة للمصادر' : 'لم تقم برفع مصادر أو كتب بعد'}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  ارفع كتب المناهج (PDF)، صور الدروس، أو المذكرات الخاصة بك ليجيب المساعد الذكي بدقة متناهية بناءً على مراجعك المعتمدة!
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddSourceModal(true)}
                  className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة أول مصدر الآن</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/30 transition group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-900/30 text-purple-300 flex items-center justify-center border border-purple-500/30 flex-shrink-0">
                        {src.type === 'pdf' ? (
                          <File className="w-4 h-4 text-rose-400" />
                        ) : src.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-teal-400" />
                        ) : (
                          <BookOpen className="w-4 h-4 text-amber-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition">
                          {src.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>
                            {src.type === 'pdf' ? 'ملف PDF 📕' : src.type === 'image' ? 'صورة درس 🖼️' : 'مرجع كتاب 📚'}
                          </span>
                          {src.fileSize && <span>• {src.fileSize}</span>}
                          {src.subject && <span>• {src.subject}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewingSource(src)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="معاينة المصدر"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(src.id, src.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="حذف المصدر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: TEMPLATES & LESSON PREP (Secondary View) */}
      {activeSection === 'smart_prep' && (
        <React.Suspense fallback={<p className="text-xs text-slate-400 text-center p-6">جارٍ التحميل...</p>}>
          <SmartPrepPanel profile={profile} />
        </React.Suspense>
      )}

      {activeSection === 'file_tools' && (
        <React.Suspense fallback={<p className="text-xs text-slate-400 text-center p-6">جارٍ التحميل...</p>}>
          <FileToolsPanel />
        </React.Suspense>
      )}

      {activeSection === 'templates' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>نماذج التحضير والاختبارات</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30">
                {templates.length}
              </span>
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreateLessonPrep()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ تحضير جديد</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="text-[11px] text-purple-300 hover:text-purple-200 underline cursor-pointer"
              >
                استعادة النماذج الافتراضية
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(['all', 'lesson_plan', 'quiz', 'summary'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTemplateFilter(t)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                  templateFilter === t
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t === 'all'
                  ? 'الكل'
                  : t === 'lesson_plan'
                  ? 'تحضير درس'
                  : t === 'quiz'
                  ? 'اختبارات قصيرة'
                  : 'تقارير أولياء الأمور'}
              </button>
            ))}
          </div>

          {/* Templates Cards Grid */}
          <div className="space-y-2">
            {filteredTemplates.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-3.5 space-y-2 hover:border-purple-400/40 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                  </div>
                  <span className="text-[10px] text-purple-300 px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/30">
                    {item.type === 'lesson_plan' ? 'تحضير' : item.type === 'quiz' ? 'اختبار' : 'تقرير'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {item.content}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewingItem(item)}
                    className="text-purple-400 hover:text-purple-300 font-bold text-[11px] cursor-pointer"
                  >
                    عرض التفاصيل والنسخ ←
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.content);
                        setCopiedId(item.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                      title="نسخ النص"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id, item.title)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: إضافة مصدر جديد (Add Source Modal) */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-3.5">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">إضافة مصدر أو كتاب جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSource} className="space-y-3 overflow-y-auto pr-0.5">
              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  رفع ملف أو صورة (PDF أو صورة المنهج)
                </label>
                <div className="rounded-2xl border-2 border-dashed border-purple-500/30 bg-slate-950/70 p-4 text-center hover:border-purple-400 transition relative">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    {isExtractingPdf ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-1 text-purple-300">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                        <p className="text-xs font-bold">جارٍ استخراج وقراءة نصوص ملف الـ PDF...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-purple-400 mx-auto" />
                        <p className="text-xs text-slate-200 font-bold">
                          {sourceFileName ? `تم اختيار: ${sourceFileName} (${sourceFileSize})` : 'اضغط لاختيار ملف PDF أو صورة المنهج'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          يتم استخراج نصوص PDF تلقائياً وضغط الصور لسرعة المعالجة
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {fileUploadError && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{fileUploadError}</span>
                  </div>
                )}

                {pdfWarningNotice && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>{pdfWarningNotice}</span>
                  </div>
                )}
              </div>

              {/* Source Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  عنوان المصدر / اسم الكتاب *
                </label>
                <input
                  type="text"
                  required
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="مثال: كتاب المعاصر - رياضيات الصف الثالث الإعدادي"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Source Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">نوع المصدر</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as LibraryItemType)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="pdf">ملف كتاب PDF 📕</option>
                    <option value="image">صورة صفحة / درس 🖼️</option>
                    <option value="book">ملخص منهج / مذكرة 📚</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">المادة</label>
                  <input
                    type="text"
                    value={sourceSubject}
                    onChange={(e) => setSourceSubject(e.target.value)}
                    placeholder="مثال: رياضيات"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Description or Content Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ملاحظات أو نبذة عن محتوى المصدر (يستخدمها الذكاء الاصطناعي)
                </label>
                <textarea
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="مثال: يحتوي هذا الملف على شرح الوحدة الأولى كاملة مع قواعد الأزمنة وأسئلة الاختبارات المقترحة..."
                  rows={3}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 leading-relaxed"
                />
              </div>

              {/* Image Preview if uploaded */}
              {sourceFileData && (
                <div className="rounded-xl border border-slate-700 overflow-hidden max-h-36">
                  <img src={sourceFileData} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSource || !sourceTitle.trim()}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-950/50 disabled:opacity-50"
                >
                  {isSavingSource ? 'جارٍ الحفظ في مكتبتك...' : 'حفظ المصدر في مكتبتي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: معاينة المصدر (Preview Source Modal) */}
      {previewingSource && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[90vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white truncate">{previewingSource.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingSource(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500/30 text-purple-300">
                  {previewingSource.type === 'pdf' ? 'ملف PDF' : previewingSource.type === 'image' ? 'صورة' : 'كتاب'}
                </span>
                {previewSourceDetail(previewingSource)}
              </div>

              {previewingSource.fileData && (
                <div className="rounded-xl overflow-hidden border border-slate-800">
                  <img src={previewingSource.fileData} alt={previewingSource.title} className="w-full object-contain max-h-72" />
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                {previewingSource.content}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setQuestion(`بناءً على مصدري (${previewingSource.title}): `);
                  setPreviewingSource(null);
                  setActiveSection('sources_ai');
                }}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>اسأل الذكاء الاصطناعي عن هذا المصدر</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewingSource(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Template Details */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[90vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <h3 className="text-sm font-bold text-white">{viewingItem.title}</h3>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text font-mono">
              {viewingItem.content}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingItem.content);
                  setCopiedId(viewingItem.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className="flex-1 py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedId === viewingItem.id ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId === viewingItem.id ? 'تم النسخ' : 'نسخ النص'}</span>
              </button>

              <button
                type="button"
                onClick={() => exportToWord(viewingItem.title, viewingItem.content, viewingItem.subject || profile.subject, profile.name)}
                className="py-2 px-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                title="تصدير إلى ملف Word (.doc)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Word</span>
              </button>

              <button
                type="button"
                onClick={() => exportToPrintPdf(viewingItem.title, viewingItem.content, viewingItem.subject || profile.subject, profile.name)}
                className="py-2 px-2.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                title="طباعة / تصدير PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = viewingItem.content;
                  setViewingItem(null);
                  handleOpenCreateLessonPrep(viewingItem.title);
                  setPrepModalContent(text);
                }}
                className="py-2 px-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                title="تعديل وإرسال هذا النموذج عبر الواتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE LESSON PREP (Edit Before Send Modal) */}
      {showCreateLessonPrepModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right max-h-[92vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-amber-300 flex items-center justify-center border border-purple-500/30">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">معاينة وتعديل تحضير الحصة قبل الإرسال</h3>
                  <p className="text-[10px] text-slate-400">
                    مادة: {profile.subject} • إعداد: أ. {profile.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateLessonPrepModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Topic & Grade Form Fields */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2.5 rounded-2xl border border-purple-500/25">
              <div>
                <label className="block text-[10px] font-bold text-purple-300 mb-1">
                  عنوان الدرس:
                </label>
                <input
                  type="text"
                  value={prepModalTopic}
                  onChange={(e) => {
                    setPrepModalTopic(e.target.value);
                    setPrepModalContent(generateNewLessonPrepText(e.target.value, prepModalGrade));
                  }}
                  placeholder="مثال: نظرية فيثاغورس"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-purple-300 mb-1">
                  الصف / المرحلة:
                </label>
                <input
                  type="text"
                  value={prepModalGrade}
                  onChange={(e) => {
                    setPrepModalGrade(e.target.value);
                    setPrepModalContent(generateNewLessonPrepText(prepModalTopic, e.target.value));
                  }}
                  placeholder="مثال: الصف الثاني الإعدادي"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Recipient Phone for WhatsApp */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-2xl border border-emerald-500/25">
              <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>رقم الواتساب المستهدف:</span>
              </span>
              <input
                type="tel"
                value={prepModalRecipientPhone}
                onChange={(e) => setPrepModalRecipientPhone(e.target.value)}
                placeholder="رقم هاتف الطالب / ولي الأمر (اختياري)..."
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Success notice */}
            {prepModalSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>تم حفظ هذا التحضير بنجاح في مكتبتك!</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>يمكنك مراجعة وتعديل نص التحضير كاملاً داخل المربع:</span>
              <button
                type="button"
                onClick={() => setPrepModalContent(generateNewLessonPrepText())}
                className="text-[11px] text-purple-300 hover:text-purple-200 underline font-medium cursor-pointer"
                title="إعادة ضبط القالب الأصلي"
              >
                استعادة القالب الأصلي 🔄
              </button>
            </div>

            {/* Editable Lesson Prep Textarea */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={prepModalContent}
                onChange={(e) => setPrepModalContent(e.target.value)}
                rows={11}
                className="w-full rounded-2xl bg-slate-950/90 border border-purple-500/30 focus:border-purple-400 p-3.5 text-xs text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition resize-y"
                placeholder="اكتب أو عدل نص تحضير الحصة هنا..."
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendPrepWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>إرسال التحضير عبر واتساب الآن 💬</span>
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                <button
                  type="button"
                  disabled={isSavingPrepModal}
                  onClick={handleSavePrepModalToLibrary}
                  className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isSavingPrepModal ? 'جارٍ الحفظ...' : 'حفظ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToWord(`تحضير ${prepModalTopic || 'درس'}`, prepModalContent, profile.subject, profile.name)}
                  className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold transition cursor-pointer active:scale-98"
                >
                  <Download className="w-3.5 h-3.5 text-blue-300" />
                  <span>Word</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToPrintPdf(`تحضير ${prepModalTopic || 'درس'}`, prepModalContent, profile.subject, profile.name)}
                  className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 text-xs font-bold transition cursor-pointer active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrepModal}
                  className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  {copiedPrepModal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrepModal ? 'تم النسخ' : 'نسخ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateLessonPrepModal(false)}
                  className="flex items-center justify-center py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function previewSourceDetail(item: LibraryItem) {
  if (item.fileName) return <span>ملف: {item.fileName}</span>;
  if (item.fileSize) return <span>حجم: {item.fileSize}</span>;
  return null;
}
