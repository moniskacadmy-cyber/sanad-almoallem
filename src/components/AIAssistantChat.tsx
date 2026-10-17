import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, AlertCircle, User, RefreshCw, Lock } from 'lucide-react';
import { TeacherProfile, Student, ScheduleSlot } from '../types';
import { auth, fetchAllStudentLessons } from '../firebase';
import { getAuthenticatedHeaders } from '../services/authHelper';
import { VoiceInputButton } from './VoiceInputButton';
import { useBackHandler } from '../services/backHandler';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onOpenUpgradeModal: () => void;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  profile,
  students,
  schedules,
  onOpenUpgradeModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close AI Assistant on Back button press
  useBackHandler(isOpen, () => setIsOpen(false), 'ai_assistant_chat');
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `أهلاً بك أ. ${profile.name || 'المعلم'} 👋\nأنا مساعدك الذكي في منصة "سند المعلم". كيف يمكنني مساعدتك اليوم في جدولك، طلابك، أو تحضير الدروس والتقارير؟`,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [unsettledCount, setUnsettledCount] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check subscription validity with single source of truth
  const isSubscriptionActive = (() => {
    if (profile.role === 'admin') return true;
    if (profile.isActive === false) return false;
    if (profile.subscriptionStatus === 'expired') return false;

    const effectiveExpiry = profile.subscriptionEndDate || profile.subscriptionExpiresAt || profile.trialEndDate;
    if (!effectiveExpiry) {
      return profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'trial';
    }

    let expiryDate: Date | null = null;
    if (typeof effectiveExpiry.toDate === 'function') {
      expiryDate = effectiveExpiry.toDate();
    } else if (typeof effectiveExpiry._seconds === 'number') {
      expiryDate = new Date(effectiveExpiry._seconds * 1000);
    } else if (typeof effectiveExpiry.seconds === 'number') {
      expiryDate = new Date(effectiveExpiry.seconds * 1000);
    } else {
      const d = new Date(effectiveExpiry);
      if (!isNaN(d.getTime())) expiryDate = d;
    }

    if (expiryDate) {
      return expiryDate.getTime() > Date.now();
    }

    return profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'trial';
  })();

  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Fetch unsettled lessons count for context summary
  useEffect(() => {
    if (isOpen && profile.id && students.length > 0) {
      fetchAllStudentLessons(profile.id, students)
        .then((lessonsMap) => {
          let count = 0;
          Object.values(lessonsMap).forEach((studentLessons) => {
            count += studentLessons.filter((l) => !l.settled).length;
          });
          setUnsettledCount(count);
        })
        .catch((err) => console.warn('Failed to fetch unsettled lessons count:', err));
    }
  }, [isOpen, profile.id, students]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Build client summary context (SAFE: student names, schedules, unsettled count ONLY; NO phone numbers / financial details)
  const buildClientSummary = () => {
    const studentNames = students.map((s) => s.name);

    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const tomorrowDayOfWeek = (todayDayOfWeek + 1) % 7;

    const todaySlots = schedules.filter((s) => s.dayOfWeek === todayDayOfWeek);
    const tomorrowSlots = schedules.filter((s) => s.dayOfWeek === tomorrowDayOfWeek);

    const formatSlot = (slot: ScheduleSlot) => {
      const student = students.find((s) => s.id === slot.studentId);
      return `${slot.time} - ${student?.name || 'طالب'}`;
    };

    return {
      teacherName: profile.name,
      subject: profile.subject,
      activeStudentsCount: students.length,
      studentNames,
      todayClasses: todaySlots.map(formatSlot),
      tomorrowClasses: tomorrowSlots.map(formatSlot),
      unsettledLessonsCount: unsettledCount,
    };
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;
    if (trimmed.length > 2000) { alert('الرسالة طويلة جداً. الحد الأقصى 2000 حرف لكل رسالة.'); return; }
    if (!isSubscriptionActive) { alert('المساعد الذكي متاح فقط للأعضاء أصحاب الاشتراكات النشطة.'); onOpenUpgradeModal(); return; }
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]); setInputMessage(''); setIsLoading(true);
    try {
      const recentHistory = messages.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text.slice(0, 1000) }));
      const headers = await getAuthenticatedHeaders();
      const summary = buildClientSummary();
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: trimmed, messagesHistory: recentHistory, summary, model: selectedModel }),
      });
      
      if (response.status === 401) {
          // Token expired, handle silently or trigger re-auth
          console.warn('Auth token expired in AIAssistantChat');
          throw new Error('رمز الدخول غير صالح أو انتهت صلاحيته.');
      }
      
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || 'فشل الاتصال بالمساعد الذكي.'); }
      if (!response.body) throw new Error('لم يتم استلام بث من المساعد الذكي.');
      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '', timestamp: new Date() }]);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find((item) => item.startsWith('data: ')); if (!line) continue;
          const payload = line.slice(6); if (payload === '[DONE]') continue;
          const chunk = JSON.parse(payload); if (chunk.error) throw new Error(chunk.error);
          if (chunk.text) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: m.text + chunk.text } : m));
        }
      }
      if (buffer.trim()) {
        const line = buffer.split('\n').find((item) => item.startsWith('data: '));
        if (line) { const payload = line.slice(6); if (payload !== '[DONE]') { const chunk = JSON.parse(payload); if (chunk.error) throw new Error(chunk.error); if (chunk.text) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: m.text + chunk.text } : m)); } }
      }
    } catch (err: any) {
      console.error('AI Assistant Error:', err);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: err.message || 'حدث خطأ غير متوقع أثناء التواصل مع المساعد الذكي.', timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };
  const handleVoiceTranscript = (text: string) => {
    setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer border border-purple-400/40 group"
          title="المساعد الذكي"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-amber-300 group-hover:rotate-12 transition" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="text-xs sm:text-sm">المساعد الذكي</span>
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        </button>
      )}

      {/* Floating Chat Window (RTL) */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[82vh] h-[580px] bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 p-4 border-b border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-amber-300 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white">المساعد الذكي</h3>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Gemini 🤖
                  </span>
                </div>
                <p className="text-[10px] text-purple-300/80">مساعدك في الجدول والدروس والتقارير</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Disclaimer Note */}
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-1.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-300/90 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>إجابات الذكاء الاصطناعي قد تحتاج مراجعة</span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/60">
            {!isSubscriptionActive && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 mx-auto flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">اشتراكك منتهي أو غير نشط</h4>
                <p className="text-[11px] text-rose-200/80 leading-relaxed">
                  المساعد الذكي متاح حصرياً للمعلمين أصحاب الاشتراكات السارية. يرجى تجديد أو ترقية خطتك للوصول.
                </p>
                <button
                  type="button"
                  onClick={onOpenUpgradeModal}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition cursor-pointer shadow"
                >
                  تجديد أو ترقية الاشتراك 👑
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-indigo-950 border border-purple-500/40 text-amber-300'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-purple-500/20 text-slate-100 rounded-tl-none shadow-sm'
                  }`}
                >
                  {m.text}
                  <div
                    className={`text-[9px] mt-1 text-left ${
                      m.role === 'user' ? 'text-purple-200/70' : 'text-slate-400/70'
                    }`}
                  >
                    {new Intl.DateTimeFormat('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(m.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-purple-300 bg-slate-900/80 p-3 rounded-2xl border border-purple-500/20 w-fit">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span>جارٍ التفكير ومعالجة سؤالك...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-slate-900 border-t border-purple-500/30 flex items-center gap-2"
          >
            <VoiceInputButton onTranscript={handleVoiceTranscript} compact />

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="اكتب سؤالك أو اطلب تحضير درس..."
              maxLength={2000}
              disabled={isLoading || !isSubscriptionActive}
              className="flex-1 bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim() || !isSubscriptionActive}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:hover:bg-purple-600 transition cursor-pointer shrink-0"
              title="إرسال"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
