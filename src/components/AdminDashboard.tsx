import React, { useState, useEffect } from 'react';
import { TeacherProfile, SubscriptionPlan } from '../types';
import {
  adminGetAllTeachers,
  adminSaveSubscription,
  adminToggleTeacherActive,
  adminActivateTeacher,
  adminSetCustomExpiry,
  adminResetTrial,
  adminDeleteTeacher,
} from '../firebase';
import {
  ShieldAlert,
  Users,
  Search,
  Calendar,
  Phone,
  Mail,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Clock,
  Ban,
  CheckCircle,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'deactivated'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<TeacherProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State: Add / Activate Teacher
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [durationChoice, setDurationChoice] = useState<'monthly' | 'three_months' | 'yearly' | 'custom'>('monthly');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Inline Custom Expiry Modal / State
  const [customExpiryTeacher, setCustomExpiryTeacher] = useState<TeacherProfile | null>(null);
  const [modalCustomDate, setModalCustomDate] = useState('');

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

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle Add / Activate New Subscription Form
  const handleAddNewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showToast('يرجى كتابة بريد إلكتروني صحيح', 'error');
      return;
    }
    if (durationChoice === 'custom' && !customEndDate) {
      showToast('يرجى تحديد تاريخ انتهاء الاشتراك', 'error');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const res = await adminSaveSubscription({
        email: newEmail.trim(),
        name: newName.trim(),
        durationType: durationChoice,
        customEndDate: durationChoice === 'custom' ? customEndDate : undefined,
        isActive: true,
      });

      showToast(res.message, 'success');
      setNewEmail('');
      setNewName('');
      setCustomEndDate('');
      setShowAddForm(false);
      await fetchTeachers();
    } catch (err: any) {
      console.error('Error adding subscription', err);
      showToast(err.message || 'حدث خطأ أثناء تفعيل الاشتراك', 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Handle Activation/Extension with preset days
  const handleExtend = async (teacher: TeacherProfile, days: number, plan: SubscriptionPlan) => {
    setActionLoadingId(teacher.id);
    try {
      await adminActivateTeacher(teacher.id, days, plan);
      showToast(`تم تمديد اشتراك ${teacher.name} بنجاح (+${days} يوم)!`);
      await fetchTeachers();
    } catch (err) {
      console.error('Error activating subscription', err);
      showToast('تعذر تمديد الاشتراك', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Setting Custom Expiry Date
  const handleApplyCustomExpiry = async () => {
    if (!customExpiryTeacher || !modalCustomDate) return;
    setActionLoadingId(customExpiryTeacher.id);
    try {
      await adminSetCustomExpiry(
        customExpiryTeacher.id,
        customExpiryTeacher.email,
        modalCustomDate,
        'custom'
      );
      showToast(`تم تحديد تاريخ انتهاء جديد للمعلم: ${modalCustomDate}`);
      setCustomExpiryTeacher(null);
      setModalCustomDate('');
      await fetchTeachers();
    } catch (err) {
      console.error('Error setting custom expiry', err);
      showToast('تعذر حفظ التاريخ', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Toggle Active/Inactive (Suspend / Unban)
  const handleToggleActive = async (teacher: TeacherProfile) => {
    const newActiveState = teacher.isActive === false; // toggle
    setActionLoadingId(teacher.id);
    try {
      await adminToggleTeacherActive(teacher.id, teacher.email, newActiveState);
      showToast(
        newActiveState
          ? `تم إعادة تفعيل حساب المعلم (${teacher.name})`
          : `تم إلغاء تفعيل / حظر حساب المعلم (${teacher.name})`
      );
      await fetchTeachers();
    } catch (err) {
      console.error('Error toggling active status', err);
      showToast('تعذر تغيير حالة الحساب', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reset trial handler
  const handleResetTrial = async (teacher: TeacherProfile) => {
    setActionLoadingId(teacher.id);
    try {
      await adminResetTrial(teacher.id);
      showToast(`تمت إعادة ضبط الفترة التجريبية (7 أيام) للمعلم ${teacher.name}!`);
      await fetchTeachers();
    } catch (err) {
      console.error('Error resetting trial', err);
      showToast('تعذر إعادة ضبط التجربة', 'error');
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
      showToast('تعذر حذف الحساب', 'error');
    }
  };

  // Statistics calculation
  const totalTeachers = teachers.length;
  const activeSubscribers = teachers.filter((t) => t.isActive !== false && t.subscriptionStatus === 'active').length;
  const inTrial = teachers.filter((t) => t.isActive !== false && t.subscriptionStatus === 'trial').length;
  const expired = teachers.filter((t) => t.subscriptionStatus === 'expired' && t.isActive !== false).length;
  const deactivated = teachers.filter((t) => t.isActive === false).length;

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.whatsapp || '').includes(searchQuery) ||
      (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return t.isActive !== false && t.subscriptionStatus === 'active';
    if (statusFilter === 'trial') return t.isActive !== false && t.subscriptionStatus === 'trial';
    if (statusFilter === 'expired') return t.isActive !== false && t.subscriptionStatus === 'expired';
    if (statusFilter === 'deactivated') return t.isActive === false;

    return true;
  });

  const getStatusBadge = (t: TeacherProfile) => {
    if (t.isActive === false) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-rose-300 border border-rose-500/40 flex items-center gap-1">
          <Ban className="w-2.5 h-2.5" />
          معطل / محظور
        </span>
      );
    }
    if (t.subscriptionStatus === 'active') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
          <CheckCircle className="w-2.5 h-2.5" />
          مشترك نشط
        </span>
      );
    }
    if (t.subscriptionStatus === 'expired') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 border border-rose-500/40 text-rose-300 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          منتهي
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300 flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5" />
        تجريبي
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-14 text-right">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-purple-900/30 p-3 rounded-2xl">
        <button
          onClick={onBackToApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-bold transition cursor-pointer border border-purple-500/20"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>تطبيق المعلم</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-amber-950/60 border border-amber-500/40 px-3 py-1 rounded-full shadow">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>لوحة إدارة الاشتراكات</span>
          </div>

          <button
            onClick={fetchTeachers}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition animate-fade-in ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 border border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Add / Activate Teacher Subscription Card */}
      <div className="bg-gradient-to-br from-purple-950/60 via-slate-900/90 to-slate-950 border border-purple-500/30 rounded-3xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">إضافة / تفعيل اشتراك معلم جديد</h3>
              <p className="text-[11px] text-purple-300/80">تفعيل فوري أو حجز اشتراك بالبريد الإلكتروني</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/30 text-xs font-bold transition cursor-pointer"
          >
            {showAddForm ? 'إخفاء النموذج' : 'فتح النموذج'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddNewSubscription} className="space-y-3 pt-2 border-t border-purple-900/30">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                البريد الإلكتروني للمعلم <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  dir="ltr"
                  className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                اسم المعلم (اختياري)
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="أ. محمد أحمد"
                className="w-full rounded-xl bg-slate-950 border border-purple-500/30 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                مدة الاشتراك المطلوبة <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'monthly', label: 'شهر (30 يوم)', price: '50 ج' },
                  { id: 'three_months', label: '3 أشهر (90 يوم)', price: '140 ج' },
                  { id: 'yearly', label: 'سنة (365 يوم)', price: '450 ج' },
                  { id: 'custom', label: 'تحديد تاريخ باليوم 📅', price: 'مخصص' },
                ].map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setDurationChoice(plan.id as any)}
                    className={`py-2 px-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      durationChoice === plan.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs">{plan.label}</span>
                    <span className="text-[10px] opacity-75">{plan.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {durationChoice === 'custom' && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 space-y-1">
                <label className="block text-[11px] font-bold text-amber-300">
                  حدد تاريخ انتهاء الاشتراك بدقة:
                </label>
                <input
                  type="date"
                  required
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingNew}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmittingNew ? 'جارٍ الحفظ والتفعيل...' : 'تفعيل / حفظ الاشتراك في قاعدة البيانات'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/20 p-2.5 text-right">
          <span className="text-[10px] text-slate-400">الإجمالي</span>
          <p className="text-lg font-black text-white">{totalTeachers}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/20 p-2.5 text-right">
          <span className="text-[10px] text-emerald-400">مشتركون</span>
          <p className="text-lg font-black text-emerald-400">{activeSubscribers}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-purple-500/20 p-2.5 text-right">
          <span className="text-[10px] text-purple-300">تجريبي</span>
          <p className="text-lg font-black text-purple-300">{inTrial}</p>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-rose-500/20 p-2.5 text-right">
          <span className="text-[10px] text-rose-400">منتهي/معطل</span>
          <p className="text-lg font-black text-rose-400">{expired + deactivated}</p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، البريد الإلكتروني، الواتساب أو المادة..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
          {[
            { id: 'all', label: `الكل (${totalTeachers})` },
            { id: 'active', label: `نشط (${activeSubscribers})` },
            { id: 'trial', label: `تجريبي (${inTrial})` },
            { id: 'expired', label: `منتهي (${expired})` },
            { id: 'deactivated', label: `معطل (${deactivated})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id as any)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === item.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teachers Management Table / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>قائمة المعلمين والاشتراكات ({filteredTeachers.length})</span>
          </h4>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-purple-300 animate-pulse bg-slate-900/40 rounded-2xl border border-purple-900/30">
            جارٍ استرجاع سجلات المعلمين والاشتراكات من Firestore...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-xs text-slate-400">
            لا يوجد معلمون مطابقون لمعايير البحث الحالية.
          </div>
        ) : (
          filteredTeachers.map((t) => {
            const rawExpiry = t.subscriptionEndDate || t.subscriptionExpiresAt;
            const expiry = rawExpiry?.toDate ? rawExpiry.toDate() : rawExpiry ? new Date(rawExpiry) : null;
            const now = new Date();
            const isPast = expiry ? expiry < now : false;
            const diffDays = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            const expiryFormatted = expiry
              ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(expiry)
              : 'غير محدد';

            const isDeactivated = t.isActive === false;

            return (
              <div
                key={t.id}
                className={`rounded-2xl bg-slate-900/90 border p-3.5 space-y-3 transition shadow-md ${
                  isDeactivated
                    ? 'border-rose-900/40 opacity-85 bg-slate-950/90'
                    : 'border-purple-500/20 hover:border-purple-400/40'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{t.name}</h4>
                      {getStatusBadge(t)}
                    </div>
                    <p className="text-xs text-purple-300/90 font-medium">المادة: {t.subject}</p>
                  </div>

                  <button
                    onClick={() => setDeleteConfirmTeacher(t)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="حذف حساب المعلم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info Block */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate" dir="ltr">{t.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end">
                    <Phone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    {t.whatsapp && t.whatsapp !== 'غير محدد بعد' ? (
                      <a
                        href={`https://wa.me/${t.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1"
                        dir="ltr"
                      >
                        <span>{t.whatsapp}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="text-slate-500">بدون واتساب</span>
                    )}
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      <span>تاريخ الانتهاء: <strong className="text-white">{expiryFormatted}</strong></span>
                    </div>

                    <div>
                      {expiry && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPast
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isPast ? `منتهي منذ ${Math.abs(diffDays || 0)} يوم` : `متبقي ${diffDays} يوم`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Extend, Toggle Active, Custom Date */}
                <div className="space-y-2">
                  {/* Quick Extensions */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[10px] text-slate-400 flex-shrink-0">تمديد:</span>

                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => handleExtend(t, 30, 'monthly')}
                      className="flex-1 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 font-bold transition disabled:opacity-50 cursor-pointer text-center"
                      title="تمديد شهر"
                    >
                      + شهر
                    </button>

                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => handleExtend(t, 90, 'three_months')}
                      className="flex-1 py-1 rounded-lg bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 font-bold transition disabled:opacity-50 cursor-pointer text-center"
                      title="تمديد 3 أشهر"
                    >
                      + 3 أشهر
                    </button>

                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => handleExtend(t, 365, 'yearly')}
                      className="flex-1 py-1 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 font-bold transition disabled:opacity-50 cursor-pointer text-center"
                      title="تمديد سنة"
                    >
                      + سنة
                    </button>

                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => {
                        setCustomExpiryTeacher(t);
                        setModalCustomDate(
                          expiry ? expiry.toISOString().split('T')[0] : ''
                        );
                      }}
                      className="py-1 px-2 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      title="تحديد تاريخ انتهاء مخصص"
                    >
                      <CalendarDays className="w-3 h-3" />
                      <span>تاريخ</span>
                    </button>
                  </div>

                  {/* Toggle Active / Inactive & Reset Trial */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => handleToggleActive(t)}
                      className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 ${
                        isDeactivated
                          ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/50'
                          : 'bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                      }`}
                    >
                      {isDeactivated ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          <span>إلغاء الحظر وتفعيل الحساب</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3 h-3" />
                          <span>إلغاء التفعيل / حظر الحساب</span>
                        </>
                      )}
                    </button>

                    <button
                      disabled={actionLoadingId === t.id}
                      onClick={() => handleResetTrial(t)}
                      className="py-1 px-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition disabled:opacity-50 cursor-pointer"
                      title="إعادة ضبط التجربة 7 أيام مجانية"
                    >
                      إعادة تجربة
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Expiry Modal */}
      {customExpiryTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-right space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">تحديد تاريخ انتهاء مخصص باليوم</h3>
              <p className="text-xs text-slate-300">
                للمعلم: <strong className="text-purple-300">{customExpiryTeacher.name}</strong> ({customExpiryTeacher.email})
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اختر تاريخ الانتهاء:
              </label>
              <input
                type="date"
                required
                value={modalCustomDate}
                onChange={(e) => setModalCustomDate(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-purple-500/40 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyCustomExpiry}
                disabled={!modalCustomDate || actionLoadingId === customExpiryTeacher.id}
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 py-2 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 shadow"
              >
                حفظ التاريخ وتفعيل الاشتراك
              </button>
              <button
                type="button"
                onClick={() => setCustomExpiryTeacher(null)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 py-2 px-4 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-3xl p-5 shadow-2xl text-right">
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
