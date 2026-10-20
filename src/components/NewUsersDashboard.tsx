import React, { useState, useEffect } from 'react';
import { TeacherProfile } from '../types';
import { adminGetAllTeachers } from '../firebase';
import { Users, Clock, Sparkles, Mail, Phone, BookOpen, Shield } from 'lucide-react';

interface NewUsersDashboardProps {
  onSelectTeacher?: (teacher: TeacherProfile) => void;
}

export const NewUsersDashboard: React.FC<NewUsersDashboardProps> = () => {
  const [users, setUsers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    adminGetAllTeachers()
      .then((data) => {
        if (!isMounted) return;
        // Sort by createdAt descending
        const sorted = data.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tB - tA;
        });
        setUsers(sorted.slice(0, 10));
      })
      .catch((err) => console.error('Error fetching new users:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="rounded-3xl bg-slate-900/90 border border-purple-500/40 p-4 sm:p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-amber-300 shadow-md border border-purple-400/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">آخر المستخدمين المعلمين انضماماً</h3>
            <p className="text-[11px] text-purple-300/80">عرض أحدث 10 مستخدمين انضموا للتطبيق</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-purple-600/20 text-purple-300 text-xs font-bold border border-purple-500/30">
          {users.length} مستخدمين
        </span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-purple-300 animate-pulse">
          جارٍ تحميل أحدث المستخدمين من قاعدة البيانات...
        </div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          لا يوجد مستخدمون مسجلون حالياً.
        </div>
      ) : (
        <div className="space-y-2.5">
          {users.map((u, idx) => {
            const rawDate = u.createdAt;
            const dateObj = rawDate?.toDate ? rawDate.toDate() : rawDate ? new Date(rawDate) : null;
            const dateFormatted = dateObj
              ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(dateObj)
              : 'حديثاً';

            return (
              <div
                key={u.id || idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-purple-900/30 hover:border-purple-500/50 transition shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-500/40 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{u.name || 'بدون اسم'}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                        {u.subject || 'عام'}
                      </span>
                      {u.role === 'admin' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold shrink-0">
                          مشرف 👑
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1" dir="ltr">
                        <Mail className="w-3 h-3 text-purple-400" />
                        {u.email}
                      </span>
                      {u.whatsapp && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          {u.whatsapp}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-950/80 border border-purple-500/30 px-2 py-1 rounded-xl">
                    {dateFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
