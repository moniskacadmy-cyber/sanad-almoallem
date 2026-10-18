import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  AlertCircle,
  User,
  RefreshCw,
  Lock,
  RotateCcw,
  Copy,
  Check,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Zap,
  Brain,
  ArrowDown,
  FileQuestion,
  Lightbulb,
} from 'lucide-react';
import { TeacherProfile, Student, ScheduleSlot } from '../types';
import { fetchAllStudentLessons } from '../firebase';
import { getAuthenticatedHeaders } from '../services/authHelper';
import { VoiceInputButton } from './VoiceInputButton';
import { useBackHandler } from '../services/backHandler';

export type ChatbotRole =
  | 'general'
  | 'lesson_planner'
  | 'quiz_generator'
  | 'parent_comms'
  | 'problem_solver';

export type GeminiModelChoice =
  | 'gemini-3.8-flash'
  | 'gemini-4-argon'
  | 'gemini-3.1-flash-lite';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  modelUsed?: string;
  roleUsed?: ChatbotRole;
}

interface AIAssistantChatProps {
  profile: TeacherProfile;
  students: Student[];
  schedules: ScheduleSlot[];
  onOpenUpgradeModal: () => void;
}

interface RoleConfig {
  id: ChatbotRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  recommendedModel: GeminiModelChoice;
  quickPrompts: string[];
}

const ROLES: RoleConfig[] = [
  {
    id: 'general',
    label: 'المساعد التربوي العام',
    shortLabel: 'عام',
    description: 'مساعدك الذكي لإدارة الجدول، متابعة الطلاب، وتنظيم المهام اليومية.',
    icon: GraduationCap,
    color: 'from-purple-500 to-indigo-600',
    recommendedModel: 'gemini-3.8-flash',
    quickPrompts: [
      'ما هي حصصي المقررة اليوم والغد؟',
      'لخص لي عدد الطلاب والاشتراكات الحالية',
      'كيف أنظم وقتي بين الحصص الخصوصية بكفاءة؟',
    ],
  },
  {
    id: 'lesson_planner',
    label: 'تحضير الدروس والخطط',
    shortLabel: 'تحضير دروس',
    description: 'خبير تصميم خطط دروس متكاملة تشمل الأهداف، التمهيد، الأنشطة، والتقويم.',
    icon: BookOpen,
    color: 'from-blue-500 to-cyan-600',
    recommendedModel: 'gemini-3.8-flash',
    quickPrompts: [
      'اقترح خطة درس تفاعلية مدتها 45 دقيقة',
      'صغ 3 أهداف سلوكية (معرفية ومهارية) لدرس جديد',
      'أفكار لأنشطة تدريس نشط وممتعة لطلابي',
    ],
  },
  {
    id: 'quiz_generator',
    label: 'إعداد الاختبارات والأسئلة',
    shortLabel: 'اختبارات',
    description: 'أخصائي قياس وتقويم يولد بنوك أسئلة متدرجة الصعوبة ونماذج إجابة نموذجية.',
    icon: FileQuestion,
    color: 'from-amber-500 to-orange-600',
    recommendedModel: 'gemini-3.8-flash',
    quickPrompts: [
      'أنشئ 5 أسئلة اختيار من متعدد مع نموذج الإجابة',
      'صغ اختباراً قصيراً (Quiz) لقياس الفهم بنهاية الحصة',
      'مسائل مقالية مع سلم درجات وتوزيع النقاط',
    ],
  },
  {
    id: 'parent_comms',
    label: 'رسائل أولياء الأمور',
    shortLabel: 'رسائل للأهالي',
    description: 'صياغة تقارير راقية ورسائل واتساب مهذبة وواضحة لمتابعة الطلاب مع أولياء الأمور.',
    icon: MessageSquare,
    color: 'from-emerald-500 to-teal-600',
    recommendedModel: 'gemini-3.8-flash',
    quickPrompts: [
      'اكتب رسالة واتساب تشيد بتقدم الطالب في الحصص الأخيرة',
      'صغ رسالة مهذبة لتنبيه ولي أمر بغياب الطالب وتحديد تعويض',
      'صياغة تقرير تقييم شهري مختصر ومحفز لولي الأمر',
    ],
  },
  {
    id: 'problem_solver',
    label: 'حل المسائل والشرح المعقد',
    shortLabel: 'شرح متقدم',
    description: 'تحليل عميق للمسائل العلمية والرياضية الصعبة وتفكيكها خطوة بخطوة مع القوانين.',
    icon: Lightbulb,
    color: 'from-rose-500 to-pink-600',
    recommendedModel: 'gemini-4-argon',
    quickPrompts: [
      'اشرح لي هذه المسألة المعقدة خطوة بخطوة مع توضيح القانون',
      'ما هي الأخطاء الشائعة التي يقع فيها الطلاب في هذا الموضوع؟',
      'قدم طريقة مبسطة لشرح مفهوم تجريدي صعب للطلاب',
    ],
  },
];

const MODELS: Array<{ id: GeminiModelChoice; label: string; badge: string; note: string; icon: React.ComponentType<{ className?: string }> }> = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'عام ومتوازن (الافتراضي)',
    note: 'مثالي لمعظم المهام التربوية والتحضير السريع والتلخيص بدقة وسلاسة.',
    icon: Sparkles,
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    badge: 'للمهام المعقدة والتفكير العميق',
    note: 'قدرة فائقة على حل المسائل المعقدة، والتحليل المنطقي والرياضي المتقدم.',
    icon: Brain,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    badge: 'استجابة فائقة السرعة',
    note: 'ردود خاطفة وسريعة جداً للمهام البسيطة والاستفسارات المباشرة.',
    icon: Zap,
  },
];

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  profile,
  students,
  schedules,
  onOpenUpgradeModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ChatbotRole>('general');
  const [selectedModel, setSelectedModel] = useState<GeminiModelChoice>('gemini-3.8-flash');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Close AI Assistant on Back button press
  useBackHandler(isOpen, () => setIsOpen(false), 'ai_assistant_chat');
  const [inputMessage, setInputMessage] = useState('');

  const storageKey = `sanad_gemini_chat_${profile.id || 'guest'}`;

  const getDefaultGreeting = (roleId: ChatbotRole): Message => {
    const roleObj = ROLES.find((r) => r.id === roleId) || ROLES[0];
    return {
      id: `welcome_${roleId}`,
      role: 'assistant',
      text: `أهلاً بك أ. ${profile.name || 'المعلم'} 👋\nأنا معك بصفتي **${roleObj.label}**.\n${roleObj.description}\n\nكيف يمكنني دعمك في عملك التعليمي اليوم؟`,
      timestamp: new Date(),
      roleUsed: roleId,
      modelUsed: roleObj.recommendedModel,
    };
  };

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
        }
      }
    } catch (_) {}
    return [getDefaultGreeting('general')];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [unsettledCount, setUnsettledCount] = useState<number>(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync message thread to local storage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        // Keep up to 50 recent messages in local storage
        localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)));
      }
    } catch (_) {}
  }, [messages, storageKey]);

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

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('auto');
    }
  }, [isOpen]);

  // Handle scroll listener to detect if user has scrolled up
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollDown(!isNearBottom);
  };

  // Change role and auto-select recommended model
  const handleSelectRole = (roleId: ChatbotRole) => {
    setSelectedRole(roleId);
    const roleObj = ROLES.find((r) => r.id === roleId);
    if (roleObj) {
      setSelectedModel(roleObj.recommendedModel);
    }
    setShowRoleSelector(false);
  };

  const handleResetChat = () => {
    if (messages.length > 1 && !window.confirm('هل تريد بدء محادثة جديدة ومسح السجل الحالي؟')) {
      return;
    }
    const freshWelcome = getDefaultGreeting(selectedRole);
    setMessages([freshWelcome]);
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {}
  };

  const handleCopyMessage = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {}
  };

  // Build client summary context
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

  const handleSendMessage = async (textToSend?: string) => {
    const raw = typeof textToSend === 'string' ? textToSend : inputMessage;
    const trimmed = raw.trim();
    if (!trimmed || isLoading) return;
    if (trimmed.length > 2000) {
      alert('الرسالة طويلة جداً. الحد الأقصى 2000 حرف لكل رسالة.');
      return;
    }
    if (!isSubscriptionActive) {
      alert('المساعد الذكي متاح فقط للأعضاء أصحاب الاشتراكات النشطة.');
      onOpenUpgradeModal();
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      // Send the last 10 turns of history for multi-turn conversational context
      const recentHistory = messages
        .filter((m) => m.text.trim())
        .slice(-10)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.text.slice(0, 1000),
        }));

      const headers = await getAuthenticatedHeaders();
      const summary = buildClientSummary();

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: trimmed,
          messagesHistory: recentHistory,
          summary,
          model: selectedModel,
          role: selectedRole,
        }),
      });

      if (response.status === 401) {
        throw new Error('رمز الدخول غير صالح أو انتهت صلاحيته.');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل الاتصال بالمساعد الذكي.');
      }
      if (!response.body) throw new Error('لم يتم استلام بث من المساعد الذكي.');

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          timestamp: new Date(),
          roleUsed: selectedRole,
          modelUsed: selectedModel,
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          const chunk = JSON.parse(payload);
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + chunk.text } : m
              )
            );
            scrollToBottom('auto');
          }
        }
      }

      if (buffer.trim()) {
        const line = buffer.split('\n').find((item) => item.startsWith('data: '));
        if (line) {
          const payload = line.slice(6);
          if (payload !== '[DONE]') {
            const chunk = JSON.parse(payload);
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + chunk.text } : m
                )
              );
              scrollToBottom('auto');
            }
          }
        }
      }
    } catch (err: any) {
      console.error('AI Assistant Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: err.message || 'حدث خطأ غير متوقع أثناء التواصل مع المساعد الذكي.',
          timestamp: new Date(),
          roleUsed: selectedRole,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  const activeRoleObj = ROLES.find((r) => r.id === selectedRole) || ROLES[0];
  const activeModelObj = MODELS.find((m) => m.id === selectedModel) || MODELS[0];
  const RoleIcon = activeRoleObj.icon;
  const ModelIcon = activeModelObj.icon;

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold shadow-2xl hover:scale-105 active:scale-95 transition cursor-pointer border border-purple-400/40 group"
          title="المساعد الذكي (Gemini Chatbot)"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-amber-300 group-hover:rotate-12 transition" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="text-xs sm:text-sm">سند المعلم الذكي</span>
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        </button>
      )}

      {/* Floating Multi-Turn Chat Window (RTL) */}
      {isOpen && (
        <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-50 w-[calc(100vw-1.5rem)] sm:w-[480px] max-h-[88vh] h-[650px] bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 p-3.5 border-b border-purple-500/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 border border-purple-400/40 flex items-center justify-center text-amber-300 shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">المساعد الذكي Gemini</h3>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    متعدد الأدوار
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-300/80">
                  <RoleIcon className="w-3 h-3 text-purple-400" />
                  <span>{activeRoleObj.label}</span>
                  <span className="text-slate-500">•</span>
                  <span>{activeModelObj.label}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetChat}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="محادثة جديدة"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Role & Model Controls Strip */}
          <div className="bg-slate-950/90 border-b border-purple-500/20 px-3 py-2 flex items-center justify-between gap-2 shrink-0 overflow-x-auto text-[11px]">
            {/* Role Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowRoleSelector(!showRoleSelector);
                  setShowModelSelector(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/30 text-purple-200 transition cursor-pointer"
              >
                <RoleIcon className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold">الدور: {activeRoleObj.shortLabel}</span>
              </button>

              {/* Role Dropdown */}
              {showRoleSelector && (
                <div className="absolute top-full mt-1.5 right-0 z-50 w-72 bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold text-purple-300 border-b border-purple-500/20 mb-1">
                    اختر تخصص المساعد الذكي:
                  </div>
                  {ROLES.map((r) => {
                    const Icon = r.icon;
                    const isCurrent = r.id === selectedRole;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectRole(r.id)}
                        className={`w-full text-right p-2 rounded-xl text-xs transition cursor-pointer flex items-start gap-2 ${
                          isCurrent
                            ? 'bg-purple-600/30 border border-purple-500 text-white font-bold'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg bg-gradient-to-r ${r.color} text-white shrink-0 mt-0.5`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">{r.label}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{r.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Model Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowModelSelector(!showModelSelector);
                  setShowRoleSelector(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-500/30 text-indigo-200 transition cursor-pointer"
              >
                <ModelIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-bold">{activeModelObj.label.replace('Gemini ', '')}</span>
              </button>

              {/* Model Dropdown */}
              {showModelSelector && (
                <div className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold text-indigo-300 border-b border-purple-500/20 mb-1">
                    اختر نموذج الذكاء الاصطناعي:
                  </div>
                  {MODELS.map((m) => {
                    const Icon = m.icon;
                    const isCurrent = m.id === selectedModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelSelector(false);
                        }}
                        className={`w-full text-right p-2 rounded-xl text-xs transition cursor-pointer flex items-start gap-2 ${
                          isCurrent
                            ? 'bg-indigo-600/30 border border-indigo-500 text-white font-bold'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">{m.label}</div>
                          <div className="text-[10px] text-amber-300 font-semibold">{m.badge}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{m.note}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Prompts Strip */}
          <div className="bg-slate-950/60 px-3 py-1.5 border-b border-purple-500/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] text-slate-400 font-bold shrink-0">اقتراحات:</span>
            {activeRoleObj.quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-purple-800/60 text-slate-300 hover:text-purple-200 border border-purple-500/20 text-[10px] whitespace-nowrap transition cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Scrollable Messages Thread */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-950/80 relative"
          >
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

            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                      isUser
                        ? 'bg-purple-600 text-white'
                        : 'bg-indigo-950 border border-purple-500/40 text-amber-300'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-purple-600 text-white rounded-tr-none shadow-md'
                        : 'bg-slate-900 border border-purple-500/30 text-slate-100 rounded-tl-none shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    <div
                      className={`text-[9px] mt-1.5 flex items-center justify-between gap-2 pt-1 border-t ${
                        isUser ? 'border-purple-400/30 text-purple-200/70' : 'border-slate-800 text-slate-400/70'
                      }`}
                    >
                      <span>
                        {new Intl.DateTimeFormat('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(m.timestamp)}
                      </span>

                      {!isUser && m.text && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          {m.modelUsed && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-slate-800 text-purple-300">
                              {m.modelUsed.replace('gemini-', '')}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(m.text, m.id)}
                            className="p-1 hover:text-white rounded cursor-pointer transition"
                            title="نسخ الرسالة"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2.5 text-xs text-purple-300 bg-slate-900/90 p-3 rounded-2xl border border-purple-500/30 w-fit shadow-md">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span className="font-medium">جارٍ التفكير ومعالجة سؤالك بواسطة Gemini...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll Down Button */}
          {showScrollDown && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-16 left-6 z-20 p-2 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white shadow-lg backdrop-blur-sm transition animate-bounce cursor-pointer"
              title="الانتقال لآخر الرسائل"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-900 border-t border-purple-500/30 flex items-center gap-2 shrink-0"
          >
            <VoiceInputButton onTranscript={handleVoiceTranscript} compact />

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`اسأل المساعد بصفتك: ${activeRoleObj.label}...`}
              maxLength={2000}
              disabled={isLoading || !isSubscriptionActive}
              className="flex-1 bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim() || !isSubscriptionActive}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:hover:bg-purple-600 transition cursor-pointer shrink-0 shadow"
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
