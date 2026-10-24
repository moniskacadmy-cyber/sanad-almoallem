import React, { useState, useEffect } from 'react';
import { TeacherProfile, QuickNote, NoteColor } from '../types';
import {
  subscribeToQuickNotes,
  addQuickNote,
  updateQuickNote,
  deleteQuickNote,
  togglePinQuickNote,
  toggleCompleteQuickNote,
} from '../firebase';
import { VoiceInputButton } from './VoiceInputButton';
import {
  StickyNote,
  Plus,
  Pin,
  Check,
  Trash2,
  Edit2,
  Copy,
  Clock,
  X,
  Lightbulb,
} from 'lucide-react';

interface QuickNotesProps {
  profile: TeacherProfile;
}

const COLOR_CONFIG: Record<
  NoteColor,
  {
    name: string;
    bg: string;
    border: string;
    text: string;
    badge: string;
    dot: string;
  }
> = {
  amber: {
    name: 'تنبيه / عام',
    bg: 'from-amber-950/40 to-slate-900/90',
    border: 'border-amber-500/30 hover:border-amber-400/50',
    text: 'text-amber-200',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  emerald: {
    name: 'متابعة / إنجاز',
    bg: 'from-emerald-950/40 to-slate-900/90',
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    text: 'text-emerald-200',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  purple: {
    name: 'أفكار وتحضير',
    bg: 'from-purple-950/40 to-slate-900/90',
    border: 'border-purple-500/30 hover:border-purple-400/50',
    text: 'text-purple-200',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    dot: 'bg-purple-400',
  },
  blue: {
    name: 'مواعيد وطلاب',
    bg: 'from-sky-950/40 to-slate-900/90',
    border: 'border-sky-500/30 hover:border-sky-400/50',
    text: 'text-sky-200',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
  },
  rose: {
    name: 'هام وعاجل',
    bg: 'from-rose-950/40 to-slate-900/90',
    border: 'border-rose-500/30 hover:border-rose-400/50',
    text: 'text-rose-200',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export const QuickNotes: React.FC<QuickNotesProps> = ({ profile }) => {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);

  // New note form state
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [selectedColor, setSelectedColor] = useState<NoteColor>('amber');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit note state
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [editText, setEditText] = useState('');
  const [editColor, setEditColor] = useState<NoteColor>('amber');
  const [editPinned, setEditPinned] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'pinned' | 'active' | 'completed'>('all');

  // Real-time listener for notes
  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);

    const unsubscribe = subscribeToQuickNotes(profile.id, (fetchedNotes) => {
      setNotes(fetchedNotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.id]);

  // Handle Add Note
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newText.trim();
    if (!cleanText || saving) return;

    setSaving(true);
    try {
      await addQuickNote(profile.id, {
        text: cleanText,
        color: selectedColor,
        isPinned,
      });
      setNewText('');
      setIsPinned(false);
      setIsAdding(false);
    } catch (err) {
      console.error('Error adding quick note:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle Edit Note
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editText.trim()) return;

    try {
      await updateQuickNote(profile.id, editingNote.id, {
        text: editText.trim(),
        color: editColor,
        isPinned: editPinned,
      });
      setEditingNote(null);
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  // Handle Delete
  const handleDelete = async (noteId: string) => {
    if (!window.confirm('هل تريد حذف هذه الملاحظة بالتأكيد؟')) return;
    try {
      await deleteQuickNote(profile.id, noteId);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  // Handle Copy Note
  const handleCopy = (note: QuickNote) => {
    navigator.clipboard.writeText(note.text);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format date
  const formatNoteDate = (timestamp: any) => {
    if (!timestamp) return 'الآن';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    if (isToday) {
      return `اليوم ${timeStr}`;
    }

    const dayStr = new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
    }).format(date);

    return `${dayStr} • ${timeStr}`;
  };

  // Filtered notes
  const filteredNotes = notes.filter((note) => {
    if (activeFilter === 'pinned') return note.isPinned;
    if (activeFilter === 'active') return !note.isCompleted;
    if (activeFilter === 'completed') return note.isCompleted;
    return true;
  });

  const pinnedCount = notes.filter((n) => n.isPinned).length;
  const activeCount = notes.filter((n) => !n.isCompleted).length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shadow-inner">
            <StickyNote className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white">ملاحظات وأفكار سريعة</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-black text-amber-300">
                {notes.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              تذكيرات فورية، مهام عاجلة، وأفكار تحضير
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-md shadow-amber-600/20 flex items-center gap-1.5 active:scale-95"
        >
          {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{isAdding ? 'إلغاء' : 'ملاحظة جديدة'}</span>
        </button>
      </div>

      {/* Add New Note Card */}
      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/40 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-purple-900/30">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>تدوين ملاحظة سريعة</span>
            </span>

            {/* Pin Toggle */}
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                isPinned
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pin className={`w-3 h-3 ${isPinned ? 'fill-amber-300' : ''}`} />
              <span>{isPinned ? 'مثبتة في الأعلى 📌' : 'تثبيت'}</span>
            </button>
          </div>

          <div>
            <textarea
              required
              rows={3}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="اكتب ملاحظتك، فكرة الدرس، أسماء الواجبات، أو تذكيرك هنا..."
              maxLength={2000}
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 leading-relaxed resize-none"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
              <div className="flex items-center gap-2">
                <VoiceInputButton
                  onTranscript={(transcript) =>
                    setNewText((prev) => (prev ? `${prev} ${transcript}` : transcript))
                  }
                  compact
                />
                <span>اضغط Ctrl+Enter للحفظ السريع</span>
              </div>
              <span>{newText.length}/2000 حرف</span>
            </div>
          </div>

          {/* Color Selector & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 ml-1">اللون:</span>
              {(Object.keys(COLOR_CONFIG) as NoteColor[]).map((c) => {
                const conf = COLOR_CONFIG[c];
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    title={conf.name}
                    className={`w-6 h-6 rounded-full transition cursor-pointer flex items-center justify-center border-2 ${
                      isSelected
                        ? 'border-white scale-110 shadow-md'
                        : 'border-transparent opacity-75 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    <span className={`w-full h-full rounded-full ${conf.dot}`} />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewText('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!newText.trim() || saving}
                className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                {saving ? (
                  <span>جارٍ الحفظ...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ الملاحظة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Tabs if multiple notes */}
      {notes.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
              activeFilter === 'all'
                ? 'bg-purple-600 text-white border-purple-500 shadow'
                : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            الكل ({notes.length})
          </button>
          {pinnedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('pinned')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                activeFilter === 'pinned'
                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow'
                  : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              المثبتة 📌 ({pinnedCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
              activeFilter === 'active'
                ? 'bg-sky-600/30 text-sky-300 border-sky-500/60 shadow'
                : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            النشطة ⏳ ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
              activeFilter === 'completed'
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow'
                : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            المنجزة ✅ ({notes.length - activeCount})
          </button>
        </div>
      )}

      {/* Notes List */}
      {loading ? (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 animate-pulse">
          جارٍ تحميل الملاحظات...
        </div>
      ) : notes.length === 0 ? (
        /* Empty State */
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950 border border-purple-950/40 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-300 mx-auto flex items-center justify-center border border-amber-500/20">
            <StickyNote className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">لا توجد ملاحظات سريعة بعد</h4>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
              دوّن أفكار الحصص، تذكيرات أولياء الأمور، أو مهامك اليومية لتبقى منظماً دائماً!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>كتابة أول ملاحظة</span>
          </button>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
          لا توجد ملاحظات تطابق الفلتر المحدد.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredNotes.map((note) => {
            const colorKey = note.color || 'amber';
            const colorConf = COLOR_CONFIG[colorKey] || COLOR_CONFIG.amber;

            return (
              <div
                key={note.id}
                className={`p-3.5 rounded-2xl bg-gradient-to-b ${colorConf.bg} border ${
                  colorConf.border
                } shadow-md hover:shadow-lg transition flex flex-col justify-between relative group ${
                  note.isCompleted ? 'opacity-65' : ''
                }`}
              >
                {/* Pinned Marker Badge */}
                {note.isPinned && (
                  <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center gap-1 shadow">
                    <Pin className="w-2.5 h-2.5 fill-slate-950" />
                    <span>مثبتة</span>
                  </div>
                )}

                {/* Content & Completion Toggle */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompleteQuickNote(profile.id, note.id, !!note.isCompleted)}
                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition cursor-pointer ${
                        note.isCompleted
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600 hover:border-amber-400 bg-slate-950/60'
                      }`}
                      title={note.isCompleted ? 'تعليم كغير منجز' : 'تعليم كمنجز'}
                    >
                      {note.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <p
                      className={`text-xs leading-relaxed whitespace-pre-wrap flex-1 break-words ${
                        note.isCompleted
                          ? 'line-through text-slate-400'
                          : 'text-slate-100 font-medium'
                      }`}
                    >
                      {note.text}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatNoteDate(note.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(note)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                      title="نسخ نص الملاحظة"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Toggle Pin Button */}
                    <button
                      type="button"
                      onClick={() => togglePinQuickNote(profile.id, note.id, !!note.isPinned)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        note.isPinned
                          ? 'text-amber-300 hover:bg-amber-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title={note.isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-300' : ''}`} />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNote(note);
                        setEditText(note.text);
                        setEditColor(note.color || 'amber');
                        setEditPinned(!!note.isPinned);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 transition cursor-pointer"
                      title="تعديل الملاحظة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                      title="حذف الملاحظة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right space-y-3">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <span>تعديل الملاحظة</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <textarea
                required
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={2000}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">اللون:</span>
                  {(Object.keys(COLOR_CONFIG) as NoteColor[]).map((c) => {
                    const conf = COLOR_CONFIG[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          editColor === c ? 'border-white scale-110' : 'border-transparent opacity-75'
                        }`}
                      >
                        <span className={`w-full h-full block rounded-full ${conf.dot}`} />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setEditPinned(!editPinned)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition ${
                    editPinned
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Pin className={`w-3 h-3 inline ml-1 ${editPinned ? 'fill-amber-300' : ''}`} />
                  <span>{editPinned ? 'مثبتة' : 'غير مثبتة'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!editText.trim()}
                  className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
