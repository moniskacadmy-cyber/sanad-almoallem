import React, { useMemo } from 'react';
import { Student, LessonLog } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { AlertTriangle, Brain, CheckCircle2, TrendingDown, Users, ShieldAlert } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface PerformanceInsightsProps {
  students: Student[];
  allLessonsMap: Record<string, LessonLog[]>;
  currency?: string;
}

export const PerformanceInsights: React.FC<PerformanceInsightsProps> = ({
  students,
  allLessonsMap,
  currency = 'ج.م',
}) => {
  const { isDark } = useTheme();

  // Process student analytics
  const studentMetrics = useMemo(() => {
    return students.map((student) => {
      const lessons = allLessonsMap[student.id] || [];
      const totalLessons = lessons.length;
      const presentCount = lessons.filter((l) => l.attendance === 'present').length;
      const absentCount = lessons.filter((l) => l.attendance === 'absent' || l.attendance === 'excused').length;
      const attendanceRate = totalLessons > 0 ? Math.round((presentCount / totalLessons) * 100) : 100;
      
      // Risk score: high absence (>30% or 3+ absences) or pending dues > 0
      const isAtRisk = (totalLessons >= 3 && attendanceRate < 70) || (absentCount >= 3) || ((student.pendingDues || 0) > 500);

      return {
        id: student.id,
        name: student.name,
        totalLessons,
        presentCount,
        absentCount,
        attendanceRate,
        pendingDues: student.pendingDues || 0,
        isAtRisk,
      };
    });
  }, [students, allLessonsMap]);

  // At-risk students list
  const atRiskStudents = useMemo(() => {
    return studentMetrics.filter((s) => s.isAtRisk || s.absentCount >= 2);
  }, [studentMetrics]);

  // Chart data: Top students needing attention (sorted by absence count descending)
  const chartData = useMemo(() => {
    return [...studentMetrics]
      .sort((a, b) => b.absentCount - a.absentCount || b.pendingDues - a.pendingDues)
      .slice(0, 7) // Top 7 students for chart visibility
      .map((s) => ({
        name: s.name.length > 10 ? s.name.substring(0, 10) + '...' : s.name,
        fullName: s.name,
        حضور: s.presentCount,
        غياب: s.absentCount,
        مستحقات: s.pendingDues,
        نسبةالحضور: s.attendanceRate,
        isAtRisk: s.isAtRisk,
      }));
  }, [studentMetrics]);

  if (students.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-purple-500/20 p-4 sm:p-6 shadow-sm dark:shadow-xl space-y-5 transition-colors" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-purple-900/30 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center border border-purple-200 dark:border-purple-500/30 shadow-inner">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>تحليلات أداء الطلاب والتنبؤ بالمتابعة</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-500/30">
                ذكاء تحليل الحضور
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-purple-300/70">
              رصد تلقائي للغياب المتكرر والمستحقات لتحديد الطلاب المحتاجين لدعم إضافي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>بحاجة لمتابعة: {atRiskStudents.length} طلاب</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recharts Bar Chart */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
            <span>مقارنة الحضور والغياب لأبرز الطلاب</span>
            <span className="text-[11px] text-slate-400 font-normal">عدد الحصص المسجلة</span>
          </div>
          <div className="h-64 w-full pt-2 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800 p-2" dir="ltr">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                لا توجد بيانات حصص كافية للتحليل
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#334155' : '#e2e8f0'}
                    opacity={isDark ? 0.4 : 0.8}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div
                            className={`p-3 rounded-2xl shadow-xl border text-right text-xs space-y-1 ${
                              isDark ? 'bg-slate-900 border-purple-500/40 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}
                            dir="rtl"
                          >
                            <p className="font-bold border-b pb-1 mb-1 border-slate-200 dark:border-slate-800">{data.fullName}</p>
                            <p className="text-emerald-500">حضور: {data.حضور} حصة</p>
                            <p className="text-rose-500">غياب/اعتذار: {data.غياب} حصة</p>
                            <p className="text-indigo-400">نسبة الحضور: {data.نسبةالحضور}%</p>
                            <p className="text-amber-400">مستحقات معلقة: {data.مستحقات} {currency}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{value}</span>}
                  />
                  <Bar dataKey="حضور" name="حضور" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="غياب" name="غياب / اعتذار" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.غياب >= 3 ? '#dc2626' : '#f87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* At-Risk Students Summary Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>تنبيهات المتابعة الإضافية</span>
            </span>
            <span className="text-[10px] text-slate-400">({atRiskStudents.length})</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {atRiskStudents.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-center space-y-1.5">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">الوضع ممتاز!</h4>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                  لا توجد حالات غياب متكرر أو مخاطر مالية ملحوظة بين الطلاب حالياً.
                </p>
              </div>
            ) : (
              atRiskStudents.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-purple-500/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                      {s.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-500/30">
                      غياب: {s.absentCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>نسبة الحضور: <strong className="text-slate-700 dark:text-slate-200">{s.attendanceRate}%</strong></span>
                    {s.pendingDues > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        مستحقات: {s.pendingDues} {currency}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceInsights;
