import React, { useState, useEffect } from 'react';
import { TeacherProfile, SubscriptionPlan } from '../types';
import {
  adminGetAllTeachers,
  adminActivateTeacher,
  adminResetTrial,
  adminDeleteTeacher,
} from '../firebase';
import {
  ShieldAlert,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  Phone,
  Mail,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  X,
  CreditCard,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'trial' | 'active' | 'expired'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<TeacherProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const data = await adminGetAllTeachers();
      setTeachers(data);
    } catch (err) {
      console.error('Error fetching teachers for admin', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Activation handler
  const handleActivate = async (teacherId: string, days: number, plan: SubscriptionPlan) => {
    setActionLoadingId(teacherId);
    try {
      await adminActivateTeacher(teacherId, days, plan);
      showToast(`تم تفعيل الاشتراك بنجاح (+${days} يوم)!`);
      await fetchTeachers();
    } catch (err) {
      console.error('Error activating subscription', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reset trial handler
  const handleResetTrial = async (teacherId: string) => {
    setActionLoadingId(teacherId);
    try {
      await adminResetTrial(teacherId);
      showToast('تمت إعادة ضبط الفترة التجريبية (7 أيام) بنجاح!');
      await fetchTeachers();
    } catch (err) {
      console.error('Error resetting trial', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete teacher handler
  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      await adminDeleteTeacher(teacherId);
      setDeleteConfirmTeacher(null);
      showToast('تم حذف حساب المعلم بنجاح.');
      await fetchTeachers();
    } catch (err) {
      console.error('Error deleting teacher', err);
    }
  };

  // Statistics calculation
  const totalTeachers = teachers.length;
  const activeSubscribers = teachers.filter((t) => t.subscriptionStatus === 'active').length;
  const inTrial = teachers.filter((t) => t.subscriptionStatus === 'trial').length;
  const expired = teachers.filter((t) => t.subscriptionStatus === 'expired').length;

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.whatsapp.includes(searchQuery) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.subscriptionStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (t: TeacherProfile) => {
    if (t.subscriptionStatus === 'active') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
          مشترك نشط
        </span>
      );
    }
    if (t.subscriptionStatus === 'expired') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 border border-rose-500/40 text-rose-300">
          منتهي
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300">
        تجريبي
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar with back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold transition cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لتطبيق المعلم</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 rounded-full">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>لوحة الإدارة الرئيسية</span>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/20 p-2.5 text-right">
          <span className="text-[10px] text-slate-400">إجمالي المعلمين</span>
          <p className="text-lg font-black text-white">{totalTeachers}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/20 p-2.5 text-right">
          <span className="text-[10px] text-emerald-400">مشتركين نشطين</span>
          <p className="text-lg font-black text-emerald-400">{activeSubscribers}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/20 p-2.5 text-right">
          <span className="text-[10px] text-purple-300">في التجربة</span>
          <p className="text-lg font-black text-purple-300">{inTrial}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-rose-500/20 p-2.5 text-right">
          <span className="text-[10px] text-rose-400">منتهي</span>
          <p className="text-lg font-black text-rose-400">{expired}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المعلم، البريد، أو الواتساب..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          {(['all', 'active', 'trial', 'expired'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {s === 'all'
                ? `الكل (${totalTeachers})`
                : s === 'active'
                ? `مشتركين (${activeSubscribers})`
                : s === 'trial'
                ? `تجريبي (${inTrial})`
                : `منتهي (${expired})`}
            </button>
          ))}
          <button
            onClick={fetchTeachers}
            className="mr-auto p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-purple-300 animate-pulse">
          جارٍ تحميل قائمة المعلمين من قاعدة البيانات...
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-xs text-slate-400">
          لا يوجد معلمون مطابقون لمعايير البحث.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeachers.map((t) => {
            const expiry = t.subscriptionExpiresAt?.toDate
              ? t.subscriptionExpiresAt.toDate()
              : t.subscriptionExpiresAt
              ? new Date(t.subscriptionExpiresAt)
              : null;
            const expiryStr = expiry
              ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(expiry)
              : 'غير محدد';

            return (
              <div
                key={t.id}
                className="rounded-2xl bg-slate-900/90 border border-purple-500/20 p-3.5 space-y-2.5 hover:border-purple-400/40 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{t.name}</h4>
                      {getStatusBadge(t)}
                    </div>
                    <p className="text-xs text-purple-300 mt-0.5">مادة: {t.subject}</p>
                  </div>

                  <button
                    onClick={() => setDeleteConfirmTeacher(t)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="حذف حساب المعلم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{t.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <a
                      href={`https://wa.me/${t.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline"
                      dir="ltr"
                    >
                      {t.whatsapp}
                    </a>
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>ينتهي الاشتراك في: <strong className="text-white">{expiryStr}</strong></span>
                  </div>
                </div>

                {/* Activation & Reset Buttons */}
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <button
                    disabled={actionLoadingId === t.id}
                    onClick={() => handleActivate(t.id, 30, 'monthly')}
                    className="flex-1 py-1 px-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 text-[11px] font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    + شهر (50ج)
                  </button>

                  <button
                    disabled={actionLoadingId === t.id}
                    onClick={() => handleActivate(t.id, 180, 'six_months')}
                    className="flex-1 py-1 px-2 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 text-[11px] font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    + 6 شهور (250ج)
                  </button>

                  <button
                    disabled={actionLoadingId === t.id}
                    onClick={() => handleActivate(t.id, 365, 'yearly')}
                    className="flex-1 py-1 px-2 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 text-[11px] font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    + سنة (450ج)
                  </button>

                  <button
                    disabled={actionLoadingId === t.id}
                    onClick={() => handleResetTrial(t.id)}
                    className="py-1 px-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition disabled:opacity-50 cursor-pointer"
                    title="إعادة ضبط التجربة 7 أيام مجانية"
                  >
                    إعادة تجربة
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-3xl p-5 shadow-2xl text-right">
            <h3 className="text-base font-bold text-white mb-2">تأكيد حذف حساب المعلم</h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              هل أنت متأكد من حذف حساب المعلم <span className="font-bold text-rose-400">"{deleteConfirmTeacher.name}"</span> ({deleteConfirmTeacher.email}) نهائياً؟
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteTeacher(deleteConfirmTeacher.id)}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white transition cursor-pointer"
              >
                نعم، احذف الحساب
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmTeacher(null)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
