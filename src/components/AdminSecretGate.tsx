import React, { useState, useEffect } from 'react';
import { User, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, checkIsAdmin } from '../firebase';
import { AdminDashboard } from './AdminDashboard';
import {
  Lock,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

interface AdminSecretGateProps {
  onBackToApp: () => void;
  currentUser: User | null;
  isAdmin: boolean;
}

export const AdminSecretGate: React.FC<AdminSecretGateProps> = ({
  onBackToApp,
  currentUser,
  isAdmin,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_gate_unlocked') === '2882026';
  });

  // Admin Firebase Auth prompt state if not authenticated as admin in Firebase
  const [adminEmail, setAdminEmail] = useState('moniskacadmy@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Focus on PIN input on mount
  useEffect(() => {
    setErrorMessage(null);
  }, []);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();

    if (cleanPin === '2882026') {
      sessionStorage.setItem('admin_gate_unlocked', '2882026');
      setIsUnlocked(true);
      setErrorMessage(null);
    } else {
      setErrorMessage('رمز الدخول غير صحيح');
      setPinInput('');
    }
  };

  const handleLockGate = () => {
    sessionStorage.removeItem('admin_gate_unlocked');
    setIsUnlocked(false);
    setPinInput('');
    onBackToApp();
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
    } catch (err: any) {
      console.error('Admin login error:', err);
      setAuthError('تعذر تسجيل الدخول بحساب المشرف. تأكد من كلمة مرور الحساب.');
    } finally {
      setAuthLoading(false);
    }
  };

  // If PIN is unlocked and user has active Firebase admin privileges
  if (isUnlocked) {
    // If user is already signed in with admin email / admin status
    const isAuthedAsAdmin = currentUser && (currentUser.email === 'moniskacadmy@gmail.com' || isAdmin);

    if (isAuthedAsAdmin) {
      return (
        <div className="space-y-3">
          <AdminDashboard
            onBackToApp={handleLockGate}
          />
        </div>
      );
    }

    // PIN is correct, but need Firebase Auth credentials to access Firestore
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-2 text-right">
        <div className="w-full max-w-sm bg-slate-900/95 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 mx-auto flex items-center justify-center shadow-lg border border-emerald-400/40">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-base font-bold text-white">تم التحقق من رمز الدخول السري!</h2>
            <p className="text-xs text-purple-200/80">
              يرجى تسجيل الدخول بحساب المشرف في Firebase للوصول إلى قاعدة بيانات المعلمين:
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                بريد المشرف (Admin Email)
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                كلمة مرور حساب Firebase
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'جارٍ تسجيل الدخول...' : 'دخول لوحة التحكم'}</span>
            </button>
          </form>

          <button
            type="button"
            onClick={handleLockGate}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            إلغاء وقفل البوابة
          </button>
        </div>
      </div>
    );
  }

  // Secret Gate Locked Screen
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-2 text-right">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900/95 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 relative">
        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-purple-800 mx-auto flex items-center justify-center shadow-lg shadow-purple-950/60 border border-amber-400/30">
            <KeyRound className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>

          <h2 className="text-lg font-black text-white tracking-wide">
            بوابة المشرف المحمية
          </h2>
          <p className="text-xs text-purple-200/80 leading-relaxed max-w-xs mx-auto">
            منطقة مشفرة ومخصصة لإدارة منصة سند المعلم. يرجى إدخال رمز الدخول السري للمتابعة:
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* PIN Form */}
        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              رمز الدخول السري (Admin PIN)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="أدخل رمز الدخول..."
                className="w-full text-center tracking-widest text-base font-black rounded-xl bg-slate-950 border border-purple-500/40 px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-slate-400 hover:text-white transition cursor-pointer"
                title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>تأكيد الرمز ودخول لوحة المشرف</span>
          </button>
        </form>

        {/* Back to App Link */}
        <div className="pt-2 border-t border-purple-900/30 text-center">
          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white transition font-medium cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للتطبيق الرئيسي</span>
          </button>
        </div>
      </div>
    </div>
  );
};
