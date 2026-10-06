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
import { TrendingUp } from 'lucide-react';

interface StatsChartProps {
  weeklyChartData: Array<{
    day: string;
    planned: number;
    completed: number;
  }>;
  totalCompletedWeek: number;
  totalPlannedWeek: number;
  weeklyCompletionPct: number;
}

export const StatsChart: React.FC<StatsChartProps> = ({
  weeklyChartData,
  totalCompletedWeek,
  totalPlannedWeek,
  weeklyCompletionPct,
}) => {
  return (
    <div className="rounded-3xl bg-slate-900/90 border border-purple-500/20 p-4 sm:p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-purple-900/30 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shadow-inner">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">إنجاز الحصص هذا الأسبوع</h3>
            <p className="text-[11px] text-purple-300/70">
              مقارنة الحصص المنجزة بالمخطط لها أسبوعياً
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/70 border border-purple-500/30 text-xs font-bold text-purple-200">
          <span>{totalCompletedWeek} / {totalPlannedWeek} حصة</span>
          <span className="text-[10px] text-emerald-400">({weeklyCompletionPct}%)</span>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="h-56 w-full pt-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={weeklyChartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#6366f1',
                borderRadius: '12px',
                fontSize: '11px',
                textAlign: 'right',
                color: '#fff',
              }}
              labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => (
                <span style={{ color: '#cbd5e1' }}>
                  {value === 'planned' ? 'المخطط لها' : 'المنجزة'}
                </span>
              )}
            />
            <Bar
              dataKey="planned"
              name="المخطط لها"
              fill="#818cf8"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="completed"
              name="المنجزة"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;
