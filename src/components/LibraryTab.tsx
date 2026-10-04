import React, { useState } from 'react';
import { TeacherProfile, LibraryItem, LibraryItemType } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import {
  auth,
  addLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  seedDefaultLibraryItems,
} from '../firebase';
import {
  BookOpen,
  Plus,
  Copy,
  Check,
  Share2,
  Trash2,
  Edit2,
  X,
  FileText,
  HelpCircle,
  Award,
  Sparkles,
  MessageCircle,
  Upload,
  FileUp,
  Image as ImageIcon,
  File,
  Eye,
  RefreshCw,
  Send,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface LibraryTabProps {
  profile: TeacherProfile;
  libraryItems: LibraryItem[];
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ profile, libraryItems }) => {
  // Tab view: Sources & AI vs Templates
  const [activeSection, setActiveSection] = useState<'sources_ai' | 'templates'>('sources_ai');

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

  // Preview Modal
  const [previewingSource, setPreviewingSource] = useState<LibraryItem | null>(null);

  // Templates Management State
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
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

  // Filter items into sources vs templates
  const sources = libraryItems.filter(
    (item) => item.type === 'pdf' || item.type === 'image' || item.type === 'book'
  );

  const templates = libraryItems.filter(
    (item) => item.type === 'lesson_plan' || item.type === 'quiz' || item.type === 'summary'
  );

  const filteredTemplates = templates.filter((t) => {
    if (templateFilter === 'all') return true;
    return t.type === templateFilter;
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: promptToSend,
          teacherName: profile.name,
          subject: profile.subject,
          sources: sourcesContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل في استلام الإجابة من الذكاء الاصطناعي');
      }

      setAiAnswer(data.answer);
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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInKB = Math.round(file.size / 1024);
    const sizeStr = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`;

    setSourceFileName(file.name);
    setSourceFileSize(sizeStr);

    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    if (file.type.includes('pdf')) {
      setSourceType('pdf');
      // For PDFs, store file name and note in content
      if (!sourceContent) {
        setSourceContent(`ملف كتاب / منهج بصيغة PDF: ${file.name} (${sizeStr})`);
      }
    } else if (file.type.startsWith('image/')) {
      setSourceType('image');
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSourceFileData(base64);
        if (!sourceContent) {
          setSourceContent(`صورة لدرس / صفحة من المنهج: ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save new Source
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceTitle.trim()) return;

    setIsSavingSource(true);
    try {
      await addLibraryItem(profile.id, {
        title: sourceTitle.trim(),
        type: sourceType,
        subject: sourceSubject.trim(),
        content: sourceContent.trim() || `مصدر تعليمي: ${sourceTitle.trim()}`,
        fileName: sourceFileName.trim() || undefined,
        fileSize: sourceFileSize.trim() || undefined,
        fileData: sourceFileData || undefined,
      });

      setShowAddSourceModal(false);
      setSourceTitle('');
      setSourceContent('');
      setSourceFileName('');
      setSourceFileSize('');
      setSourceFileData(undefined);
    } catch (err) {
      console.error('Error saving source:', err);
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
    try {
      await addLibraryItem(profile.id, {
        title: `تحضير: ${prepModalTopic.trim() || 'درس جديد'} (${profile.subject})`,
        type: 'lesson_plan',
        subject: profile.subject,
        content: prepModalContent.trim(),
      });
      setPrepModalSuccessMsg(true);
      setTimeout(() => {
        setPrepModalSuccessMsg(false);
        setShowCreateLessonPrepModal(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving lesson prep:', err);
    } finally {
      setIsSavingPrepModal(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>مكتبتي - مصادر التدريس الخاصة بك</span>
          </h2>
          <p className="text-xs text-slate-400">
            المساعد الذكي لمناهجك ومستودع الكتب والتحضيرات
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenCreateLessonPrep()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-950/40 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء تحضير للحصة 📝</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs: AI & Sources vs Templates */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900 border border-purple-500/20 text-xs">
        <button
          type="button"
          onClick={() => setActiveSection('sources_ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold transition cursor-pointer ${
            activeSection === 'sources_ai'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>المساعد الذكي والمصادر ({sources.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('templates')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold transition cursor-pointer ${
            activeSection === 'templates'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>نماذج التحضير والاختبارات ({templates.length})</span>
        </button>
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
                    {sources.length} مصادر
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
            {sources.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/50 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                  <FileUp className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-white">لم تقم برفع مصادر أو كتب بعد</h4>
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
                {sources.map((src) => (
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
                    <Upload className="w-6 h-6 text-purple-400 mx-auto" />
                    <p className="text-xs text-slate-200 font-bold">
                      {sourceFileName ? `تم اختيار: ${sourceFileName}` : 'اضغط لاختيار ملف PDF أو صورة المنهج'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      يدعم الكتب والملازم والملخصات وصور صفحات الدروس
                    </p>
                  </div>
                </div>
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

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingItem.content);
                  setCopiedId(viewingItem.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedId === viewingItem.id ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId === viewingItem.id ? 'تم النسخ بنجاح!' : 'نسخ النص بالكامل'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = viewingItem.content;
                  setViewingItem(null);
                  handleOpenCreateLessonPrep(viewingItem.title);
                  setPrepModalContent(text);
                }}
                className="py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                title="تعديل وإرسال هذا النموذج عبر الواتساب"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال عبر واتساب</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>إرسال التحضير عبر واتساب الآن 💬</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isSavingPrepModal}
                  onClick={handleSavePrepModalToLibrary}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isSavingPrepModal ? 'جارٍ الحفظ...' : 'حفظ في مكتبتي'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrepModal}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer active:scale-98"
                >
                  {copiedPrepModal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrepModal ? 'تم النسخ!' : 'نسخ النص'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateLessonPrepModal(false)}
                  className="flex items-center justify-center py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-98"
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
