import React, { useState } from 'react';
import { TeacherProfile, LibraryItem } from '../types';
import {
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
} from 'lucide-react';

interface LibraryTabProps {
  profile: TeacherProfile;
  libraryItems: LibraryItem[];
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ profile, libraryItems }) => {
  const [filterType, setFilterType] = useState<'all' | 'lesson_plan' | 'quiz' | 'summary'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<LibraryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'lesson_plan' | 'quiz' | 'summary'>('lesson_plan');
  const [formSubject, setFormSubject] = useState(profile.subject || 'عام');
  const [formContent, setFormContent] = useState('');

  const filteredItems = libraryItems.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType('lesson_plan');
    setFormSubject(profile.subject || 'عام');
    setFormContent('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: LibraryItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(item.type);
    setFormSubject(item.subject || profile.subject || 'عام');
    setFormContent(item.content);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingItem) {
        await updateLibraryItem(profile.id, editingItem.id, {
          title: formTitle.trim(),
          type: formType,
          subject: formSubject.trim(),
          content: formContent.trim(),
        });
      } else {
        await addLibraryItem(profile.id, {
          title: formTitle.trim(),
          type: formType,
          subject: formSubject.trim(),
          content: formContent.trim(),
        });
      }
      setShowAddModal(false);
    } catch (err) {
      console.error('Error saving library item', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا النموذج؟')) {
      try {
        await deleteLibraryItem(profile.id, id);
        if (viewingItem?.id === id) setViewingItem(null);
      } catch (err) {
        console.error('Error deleting library item', err);
      }
    }
  };

  const handleCopyContent = (item: LibraryItem) => {
    navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleWhatsAppShare = (item: LibraryItem) => {
    const text = encodeURIComponent(`*${item.title}*\n\n${item.content}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleRestoreDefaults = async () => {
    if (window.confirm('هل تريد إضافة النماذج المقترحة الافتراضية إلى مكتبتك؟')) {
      await seedDefaultLibraryItems(profile.id);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'lesson_plan':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-300">
            <FileText className="w-3 h-3" />
            <span>تحضير درس</span>
          </span>
        );
      case 'quiz':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 text-amber-300">
            <HelpCircle className="w-3 h-3" />
            <span>اختبار قصير (Quiz)</span>
          </span>
        );
      case 'summary':
        return (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
            <Award className="w-3 h-3" />
            <span>تقرير متابعة</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">مكتبتي ({libraryItems.length})</h2>
          <p className="text-xs text-slate-400">نماذج تحضير الحصص، بنوك الأسئلة والاختبارات القصيرة</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة نموذج</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'all'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          الكل ({libraryItems.length})
        </button>
        <button
          onClick={() => setFilterType('lesson_plan')}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'lesson_plan'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          تحضير الدروس
        </button>
        <button
          onClick={() => setFilterType('quiz')}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'quiz'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          الاختبارات القصيرة
        </button>
        <button
          onClick={() => setFilterType('summary')}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            filterType === 'summary'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          تقارير المتابعة
        </button>
      </div>

      {/* Library Items List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-purple-400/60 mb-2" />
          <p className="text-sm font-bold text-slate-200">لا توجد نماذج محفوظة في هذا القسم</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            يمكنك إنشاء نموذج مخصص أو استعادة النماذج الجاهزة المقترحة.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نموذج جديد</span>
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-purple-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>استعادة النماذج الجاهزة</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 hover:border-purple-400/40 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() => setViewingItem(item)}
                      className="text-sm font-bold text-white hover:text-purple-300 cursor-pointer transition"
                    >
                      {item.title}
                    </h3>
                    {getTypeBadge(item.type)}
                  </div>
                  {item.subject && (
                    <p className="text-[11px] text-purple-300/80 mt-0.5">مادة: {item.subject}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyContent(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                    title="نسخ المحتوى"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                    title="مشاركة عبر واتساب"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="تعديل"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Snippet preview */}
              <div
                onClick={() => setViewingItem(item)}
                className="cursor-pointer rounded-xl bg-slate-950/60 p-2.5 text-xs text-slate-300 font-mono whitespace-pre-wrap line-clamp-3 leading-relaxed border border-slate-800/80 hover:border-slate-700"
              >
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Item Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{viewingItem.title}</h3>
                  {getTypeBadge(viewingItem.type)}
                </div>
                {viewingItem.subject && (
                  <p className="text-xs text-purple-300 mt-0.5">مادة: {viewingItem.subject}</p>
                )}
              </div>
              <button
                onClick={() => setViewingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950/80 rounded-2xl p-4 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 select-text">
              {viewingItem.content}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyContent(viewingItem)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  {copiedId === viewingItem.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>تم النسخ للحافظة!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ النص كاملاً</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleWhatsAppShare(viewingItem)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مشاركة بالواتساب</span>
                </button>
              </div>

              <button
                onClick={() => {
                  const toEdit = viewingItem;
                  setViewingItem(null);
                  handleOpenEdit(toEdit);
                }}
                className="p-2 text-slate-400 hover:text-white transition cursor-pointer"
                title="تعديل"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingItem ? 'تعديل النموذج' : 'إضافة نموذج جديد'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  عنوان النموذج *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: تحضير درس الأفعال الخمسة أو اختبار الوحدة الأولى"
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    تصنيف النموذج
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(e.target.value as 'lesson_plan' | 'quiz' | 'summary')
                    }
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="lesson_plan">تحضير درس</option>
                    <option value="quiz">اختبار قصير (Quiz)</option>
                    <option value="summary">تقرير متابعة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">المادة</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="مثال: لغة عربية"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  محتوى النموذج والأسئلة *
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="اكتب أو الصق نص التحضير أو أسئلة الاختبار هنا بالتفصيل..."
                  rows={8}
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : editingItem ? 'حفظ التعديلات' : 'إضافة للمكتبة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
