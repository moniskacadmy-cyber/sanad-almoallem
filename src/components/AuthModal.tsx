import React, { useState } from 'react';
import {
  registerTeacher,
  signInWithGoogle,
  auth,
} from '../firebase';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  User,
} from 'firebase/auth';
import {
  Sparkles,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  BookOpen,
  ArrowRight,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);

  // Registration Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [subject, setSubject] = useState('رياضيات');
  const [customSubject, setCustomSubject] = useState('');

  // Google pending state (if new user needs to complete profile)
  const [googlePendingUser, setGooglePendingUser] = useState<User | null>(null);

  const subjectsList = [
    'رياضيات',
    'لغة عربية',
    'لغة إنجليزية',
    'علوم',
    'فيزياء',
    'كيمياء',
    'أحياء',
    'دراسات اجتماعية',
    'تاريخ',
    'جغرافيا',
    'لغة فرنسية',
    'لغة ألمانية',
    'فلسفة ومنطق',
    'حاسب آلي وتكنولوجيا',
    'أخرى (تحديد مخصص)',
  ];

  const effectiveSubject = subject === 'أخرى (تحديد مخصص)' ? customSubject : subject;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (googlePendingUser) {
        // Finishing google signup
        if (!name.trim() || !whatsapp.trim() || !effectiveSubject.trim()) {
          throw new Error('يرجى ملء جميع البيانات المطلوبة لإكمال التسجيل.');
        }
        await registerTeacher({
          name: name.trim(),
          email: googlePendingUser.email || '',
          whatsapp: whatsapp.trim(),
          subject: effectiveSubject.trim(),
          existingUser: googlePendingUser,
        });
        onSuccess();
        return;
      }

      if (isRegister) {
        // Validations
        if (!name.trim() || !email.trim() || !password || !whatsapp.trim() || !effectiveSubject.trim()) {
          throw new Error('يرجى ملء كافة الحقول لإتمام التسجيل.');
        }
        if (password.length < 6) {
          throw new Error('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام.');
        }

        await registerTeacher({
          name: name.trim(),
          email: email.trim(),
          password,
          whatsapp: whatsapp.trim(),
          subject: effectiveSubject.trim(),
        });
        onSuccess();
      } else {
        // Login
        if (!email.trim() || !password) {
          throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Auth error', err);
      if (err?.message === 'EMAIL_VERIFICATION_REQUIRED') {
        setVerificationRequired(true);
        setError(null);
        return;
      }
      let msg = err.message || 'حدث خطأ، يرجى المحاولة لاحقاً.';
      if (msg.includes('auth/email-already-in-use')) {
        msg = 'هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول.';
      } else if (msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found') || msg.includes('auth/invalid-credential')) {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'صيغة البريد الإلكتروني غير صحيحة.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { user, isNew } = await signInWithGoogle();
      if (isNew) {
        // Needs WhatsApp and Subject
        setGooglePendingUser(user);
        setName(user.displayName || '');
        setEmail(user.email || '');
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Google sign-in error', err);
      setError('تعذر تسجيل الدخول عبر Google. يرجى المحاولة مجدداً أو التسجيل بالبريد.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('يرجى كتابة بريدك الإلكتروني لإرسال رابط الاستعادة.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSuccess(true);
    } catch (err: any) {
      setError('تعذر إرسال رابط الاستعادة. تأكد من صحة البريد.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-[460px] bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative text-right">
        {/* App Title and Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 mb-3 border border-purple-400/30">
            <BookOpen className="w-8 h-8 text-amber-300" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">
            سند المعلم
          </h1>
          <p className="text-xs text-purple-200/80 mt-1 max-w-xs">
            المنصة الذكية لتنظيم حصص وطلاب المعلمين الخصوصيين
          </p>
        </div>

        {/* Free trial highlight banner */}
        {!googlePendingUser && (
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/40 p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/50 flex items-center justify-center flex-shrink-0 text-amber-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-300">تجربة مجانية كاملة لمدة 7 أيام</p>
              <p className="text-[11px] text-purple-200 mt-0.5 leading-snug">
                سجل حسابك واستمتع بجميع المميزات تلقائياً وبدون أي بطاقة بنكية.
              </p>
            </div>
          </div>
        )}

        {/* Email verification gate */}
        {verificationRequired ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30">
              <Mail className="w-10 h-10 mx-auto text-amber-300 mb-2" />
              <h3 className="text-base font-bold text-white">فعّل بريدك الإلكتروني أولاً</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                أرسلنا رابط تفعيل إلى <span className="font-bold text-amber-300" dir="ltr">{email}</span>.
                لن يتم إنشاء ملف المعلم أو تفعيل الاشتراك المسبق قبل تأكيد البريد.
              </p>
            </div>
            {error && <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">{error}</div>}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const user = auth.currentUser;
                  if (!user) throw new Error('انتهت جلسة التسجيل، يرجى تسجيل الدخول من جديد.');
                  await user.reload();
                  if (!auth.currentUser?.emailVerified) {
                    throw new Error('لم يتم تأكيد البريد بعد. افتح رسالة التفعيل ثم أعد المحاولة.');
                  }
                  await registerTeacher({
                    name: name.trim(),
                    email: email.trim(),
                    whatsapp: whatsapp.trim(),
                    subject: effectiveSubject.trim(),
                    existingUser: auth.currentUser,
                  });
                  setVerificationRequired(false);
                  onSuccess();
                } catch (err: any) {
                  setError(err.message || 'تعذر إكمال التسجيل.');
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'جارٍ التحقق...' : 'تحققت من البريد — متابعة التسجيل'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                try {
                  if (auth.currentUser && !auth.currentUser.emailVerified) {
                    await sendEmailVerification(auth.currentUser);
                    setError('تم إرسال رسالة تفعيل جديدة إلى بريدك.');
                  }
                } catch (err: any) {
                  setError(err.message || 'تعذر إعادة إرسال رسالة التفعيل.');
                }
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 text-xs font-bold text-slate-200 disabled:opacity-50"
            >
              إعادة إرسال رسالة التفعيل
            </button>
          </div>
        ) : (
          <>
        {/* Forgot Password View */}
        {showForgot ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">استعادة كلمة المرور</h3>
              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setResetSuccess(false);
                  setError(null);
                }}
                className="text-xs text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>العودة لتسجيل الدخول</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {resetSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                <p className="font-bold">تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك!</p>
                <p className="text-slate-300">تفقد صندوق الوارد أو الرسائل غير المرغوب فيها (Spam).</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    بريدك الإلكتروني المسجل
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@example.com"
                      required
                      dir="ltr"
                      className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-3 text-sm font-bold text-white transition active:scale-98 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-900/40"
                >
                  {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
                </button>
              </form>
            )}
          </div>
        ) : googlePendingUser ? (
          /* Profile Completion for Google Sign In */
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-white">إكمال بيانات المعلم</h3>
              <p className="text-xs text-purple-300">
                مرحباً {googlePendingUser.displayName || ''}! يرجى استكمال خطوة أخيرة للبدء:
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الاسم بالكامل</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أ. محمد أحمد"
                  required
                  className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الواتساب</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="01012345678"
                  required
                  dir="ltr"
                  className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">المادة الرئيسية</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                >
                  {subjectsList.map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {subject === 'أخرى (تحديد مخصص)' && (
                <div>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="اكتب اسم المادة هنا"
                    required
                    className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold text-white transition active:scale-98 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-900/40"
              >
                {loading ? 'جارٍ الإعداد...' : 'بدء التجربة المجانية (7 أيام) 🚀'}
              </button>
            </form>
          </div>
        ) : (
          /* Normal Auth Tab View */
          <div>
            {/* Toggle Tabs */}
            <div className="flex rounded-xl bg-slate-800/80 p-1 mb-5 border border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isRegister
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>حساب جديد (تجربة مجانية)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !isRegister
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>تسجيل الدخول</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isRegister && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    الاسم الكامل (المعلم)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أ. أحمد محمود"
                      required
                      className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-purple-400 transition"
                    />
                    <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    required
                    dir="ltr"
                    className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-purple-400 transition"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">كلمة المرور</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-[11px] text-purple-300 hover:text-white underline cursor-pointer"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    dir="ltr"
                    minLength={6}
                    className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-purple-400 transition"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {isRegister && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      رقم الواتساب (للتواصل وإرسال التقارير)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="01012345678"
                        required
                        dir="ltr"
                        className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-purple-400 transition"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      المادة الرئيسية التي تدرسها
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                    >
                      {subjectsList.map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {subject === 'أخرى (تحديد مخصص)' && (
                    <div>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="حدد المادة"
                        required
                        className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold text-white transition active:scale-98 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-900/40"
              >
                {loading
                  ? 'جارٍ التحميل...'
                  : isRegister
                  ? 'إنشاء الحساب وبدء التجربة المجانية (7 أيام) 🚀'
                  : 'تسجيل الدخول'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/60"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900 px-2 text-slate-500">أو عبر</span>
              </div>
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 py-2.5 px-4 text-xs font-bold text-slate-200 transition cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>المتابعة باستخدام Google</span>
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
