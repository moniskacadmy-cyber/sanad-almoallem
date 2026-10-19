import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface WeeklyDayData {
  day: string;
  planned: number;
  completed: number;
  date?: string;
  isToday?: boolean;
}

interface StatsChartProps {
  weeklyChartData: WeeklyDayData[];
  totalCompletedWeek: number;
  totalPlannedWeek: number;
  weeklyCompletionPct: number;
  todayDayName?: string;
  onNavigateToSchedules?: () => void;
}

export const StatsChart: React.FC<StatsChartProps> = ({
  weeklyChartData,
  totalCompletedWeek,
  totalPlannedWeek,
  weeklyCompletionPct,
  todayDayName,
  onNavigateToSchedules,
}) => {
  const { isDark } = useTheme();

  // Find peak day (day with the most planned lessons)
  const peakDay = weeklyChartData.reduce<WeeklyDayData | null>((max, current) => {
    if (!max || current.planned > max.planned) {
      return current;
    }
    return max;
  }, null);

  const remainingLessons = Math.max(0, totalPlannedWeek - totalCompletedWeek);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const planned = payload.find((p: any) => p.dataKey === 'planned')?.value ?? 0;
      const completed = payload.find((p: any) => p.dataKey === 'completed')?.value ?? 0;
      const dayItem = weeklyChartData.find((d) => d.day === label);
      const isTodayItem = dayItem?.isToday || label === todayDayName;
      const completionRate = planned > 0 ? Math.round((completed / planned) * 100) : 0;

      return (
        <div
          className={`p-3 shadow-xl border text-right transition-colors ${
            isDark
              ? 'bg-[#0f172a] border-[#334155] text-[#f8fafc]'
              : 'bg-[#ffffff] border-[#e2e8f0] text-[#0f172a]'
          }`}
          style={{ borderRadius: '12px', fontSize: '11px' }}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-2 border-slate-200 dark:border-slate-800">
            <span className="font-bold text-xs">{label}</span>
            {isTodayItem && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold">
                اليوم
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-3 text-indigo-600 dark:text-indigo-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                المخطط لها:
              </span>
              <span className="font-bold">{planned} حصة</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                المنجزة:
              </span>
              <span className="font-bold">{completed} حصة</span>
            </div>
            {planned > 0 && (
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>نسبة الإنجاز:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{completionRate}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-purple-500/20 p-4 sm:p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors"
      aria-label="لوحة إحصائيات توزيع الحصص الأسبوعية"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-purple-900/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center border border-purple-200 dark:border-purple-500/30 shadow-inner">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              توزيع الحصص خلال الأسبوع الحالي
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-purple-300/70">
              لوحة إحصائية وتخطيطية لمتابعة إنجاز الحصص الموزعة على الأيام
            </p>
          </div>
        </div>

        {/* Global Progress Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-500/30 text-xs font-bold text-purple-700 dark:text-purple-200">
            <span>{totalCompletedWeek} / {totalPlannedWeek} حصة</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-extrabold">
              {weeklyCompletionPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 4 Planning Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Planned */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
              إجمالي المخطط
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {totalPlannedWeek} <span className="text-[10px] font-normal text-slate-500">حصة</span>
            </span>
          </div>
        </div>

        {/* Total Completed */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
              تم إنجازها
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {totalCompletedWeek} <span className="text-[10px] font-normal text-slate-500">حصة</span>
            </span>
          </div>
        </div>

        {/* Remaining Lessons */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
              المتبقي للتدريس
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {remainingLessons} <span className="text-[10px] font-normal text-slate-500">حصة</span>
            </span>
          </div>
        </div>

        {/* Peak Day (Planning insight) */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
              ذروة الأسبوع
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-300 truncate block">
              {peakDay && peakDay.planned > 0
                ? `${peakDay.day} (${peakDay.planned})`
                : 'متوازن'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {totalPlannedWeek === 0 && totalCompletedWeek === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              لا توجد حصص مجدولة لهذا الأسبوع حتى الآن
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              أضف مواعيد لحصصك الأسبوعية في جدول المواعيد لتبدأ بمتابعة توزيع الحصص والتخطيط لأيامك بسهولة.
            </p>
          </div>
          {onNavigateToSchedules && (
            <button
              type="button"
              onClick={onNavigateToSchedules}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <span>إضافة مواعيد في الجدول</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Recharts Bar Chart */}
          <div className="h-60 w-full pt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyChartData}
                margin={{ top: 12, right: 10, left: -22, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  opacity={isDark ? 0.4 : 0.8}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                />
                <YAxis
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => (
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600 font-medium'}>
                      {value === 'planned' ? 'الحصص المخططة' : 'الحصص المنجزة'}
                    </span>
                  )}
                />
                <Bar
                  dataKey="planned"
                  name="الحصص المخططة"
                  fill={isDark ? '#818cf8' : '#6366f1'}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="completed"
                  name="الحصص المنجزة"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 7-Days Quick Distribution Row */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
              {weeklyChartData.map((d) => {
                const isToday = d.isToday || d.day === todayDayName;
                const isFullyCompleted = d.planned > 0 && d.completed >= d.planned;
                return (
                  <div
                    key={d.day}
                    className={`py-1.5 px-1 rounded-xl transition-all ${
                      isToday
                        ? 'bg-purple-100/80 dark:bg-purple-900/40 border border-purple-400/50 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-950/40 border border-transparent'
                    }`}
                  >
                    <span
                      className={`block text-[10px] font-bold ${
                        isToday
                          ? 'text-purple-700 dark:text-purple-300'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {d.day}
                    </span>
                    <span
                      className={`block text-[11px] font-extrabold mt-0.5 ${
                        isFullyCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : d.planned > 0
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {d.completed}/{d.planned}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default StatsChart;
