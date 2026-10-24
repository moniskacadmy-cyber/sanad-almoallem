import React, { useState } from 'react';
import { User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { AdminDashboard } from './AdminDashboard';
import {
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

interface AdminSecretGateProps {
  onBackToApp: () => void;
  currentUser: User | null;
  isAdmin: boolean;
  /** False while the background admin check is still running. */
  adminChecked?: boolean;
}

export const AdminSecretGate: React.FC<AdminSecretGateProps> = ({
  onBackToApp,
  currentUser,
  isAdmin,
  adminChecked = true,
}) => {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
    } catch (err: any) {
      console.error('Admin login error:', err);
      setAuthError('تعذر تسجيل الدخول بحساب المشرف. تأكد من صحة البريد الإلكتروني وكلمة المرور.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // 1. If user is authenticated and verified as admin in the Firestore admins collection
  if (currentUser && isAdmin) {
    return (
      <div className="space-y-3">
        <AdminDashboard onBackToApp={onBackToApp} />
      </div>
    );
  }

  // 1b. Signed in but the admin check has not finished yet: never show "unauthorized" prematurely.
  if (currentUser && !isAdmin && !adminChecked) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center text-xs text-purple-200/80">
        جاري التحقق من الصلاحيات...
      </div>
    );
  }

  // 2. If user is signed in but does not have admin permissions in the admins collection
  if (currentUser && !isAdmin) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-2 text-right">
        <div className="w-full max-w-sm bg-slate-900/95 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center shadow-lg border border-amber-500/30">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-base font-bold text-white">غير مصرح بالدخول</h2>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              الحساب الحالي ({currentUser.email}) ليس لديه صلاحيات المشرف. لوحة التحكم متاحة فقط للمشرفين المسجلين في النظام.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>تسجيل الخروج والتبديل لحساب المشرف</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="w-full py-2.5 rounded-xl bg-purple-900/50 hover:bg-purple-900/70 text-purple-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للتطبيق الرئيسي</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. User is not signed in: provide login form for admin
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-2 text-right">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900/95 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 relative">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-purple-800 mx-auto flex items-center justify-center shadow-lg shadow-purple-950/60 border border-amber-400/30">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
          </div>

          <h2 className="text-lg font-black text-white tracking-wide">
            بوابة دخول المشرف
          </h2>
          <p className="text-xs text-purple-200/80 leading-relaxed max-w-xs mx-auto">
            يرجى تسجيل الدخول بحساب المشرف للوصول إلى لوحة إدارة المعلمين والاشتراكات:
          </p>
        </div>

        {authError && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAdminSignIn} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              البريد الإلكتروني للمشرف
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              dir="ltr"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-2.5 top-2 text-slate-400 hover:text-white transition cursor-pointer"
                title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
