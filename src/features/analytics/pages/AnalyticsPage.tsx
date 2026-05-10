import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Period = 'weekly' | 'monthly' | 'yearly';

type DataPoint = {
  label: string;
  sales: number;
};

type TimelineData = Record<string, DataPoint[]>;

const weeklyData: TimelineData = {
  'Week 1': [
    { label: 'Mon', sales: 9000 },
    { label: 'Tue', sales: 11200 },
    { label: 'Wed', sales: 10400 },
    { label: 'Thu', sales: 12800 },
    { label: 'Fri', sales: 14900 },
    { label: 'Sat', sales: 16500 },
    { label: 'Sun', sales: 12100 },
  ],
  'Week 2': [
    { label: 'Mon', sales: 9400 },
    { label: 'Tue', sales: 10800 },
    { label: 'Wed', sales: 11800 },
    { label: 'Thu', sales: 13200 },
    { label: 'Fri', sales: 15600 },
    { label: 'Sat', sales: 17100 },
    { label: 'Sun', sales: 12900 },
  ],
  'Week 3': [
    { label: 'Mon', sales: 8600 },
    { label: 'Tue', sales: 9700 },
    { label: 'Wed', sales: 11000 },
    { label: 'Thu', sales: 12100 },
    { label: 'Fri', sales: 13800 },
    { label: 'Sat', sales: 15900 },
    { label: 'Sun', sales: 11600 },
  ],
  'Week 4': [
    { label: 'Mon', sales: 10100 },
    { label: 'Tue', sales: 11700 },
    { label: 'Wed', sales: 12600 },
    { label: 'Thu', sales: 13400 },
    { label: 'Fri', sales: 16400 },
    { label: 'Sat', sales: 17900 },
    { label: 'Sun', sales: 13600 },
  ],
};

const monthlyData: TimelineData = {
  January: [
    { label: 'Week 1', sales: 68000 },
    { label: 'Week 2', sales: 72000 },
    { label: 'Week 3', sales: 70500 },
    { label: 'Week 4', sales: 76000 },
  ],
  February: [
    { label: 'Week 1', sales: 65000 },
    { label: 'Week 2', sales: 69400 },
    { label: 'Week 3', sales: 71000 },
    { label: 'Week 4', sales: 74800 },
  ],
  March: [
    { label: 'Week 1', sales: 70200 },
    { label: 'Week 2', sales: 73900 },
    { label: 'Week 3', sales: 78300 },
    { label: 'Week 4', sales: 80900 },
  ],
  April: [
    { label: 'Week 1', sales: 74100 },
    { label: 'Week 2', sales: 79500 },
    { label: 'Week 3', sales: 81200 },
    { label: 'Week 4', sales: 85600 },
  ],
  May: [
    { label: 'Week 1', sales: 76000 },
    { label: 'Week 2', sales: 80400 },
    { label: 'Week 3', sales: 83500 },
    { label: 'Week 4', sales: 88000 },
  ],
};

const yearlyData: TimelineData = {
  2022: [
    { label: 'Q1', sales: 520000 },
    { label: 'Q2', sales: 558000 },
    { label: 'Q3', sales: 602000 },
    { label: 'Q4', sales: 634000 },
  ],
  2023: [
    { label: 'Q1', sales: 570000 },
    { label: 'Q2', sales: 619000 },
    { label: 'Q3', sales: 655000 },
    { label: 'Q4', sales: 701000 },
  ],
  2024: [
    { label: 'Q1', sales: 610000 },
    { label: 'Q2', sales: 668000 },
    { label: 'Q3', sales: 724000 },
    { label: 'Q4', sales: 776000 },
  ],
  2025: [
    { label: 'Q1', sales: 690000 },
    { label: 'Q2', sales: 745000 },
    { label: 'Q3', sales: 791000 },
    { label: 'Q4', sales: 842000 },
  ],
};

type ProfitPoint = {
  label: string;
  revenue: number;
  expenses: number;
};

type ProfitTimelineData = Record<string, ProfitPoint[]>;

const weeklyProfitData: ProfitTimelineData = {
  'Week 1': [
    { label: 'Mon', revenue: 9000, expenses: 5900 },
    { label: 'Tue', revenue: 11200, expenses: 7100 },
    { label: 'Wed', revenue: 10400, expenses: 6900 },
    { label: 'Thu', revenue: 12800, expenses: 7900 },
    { label: 'Fri', revenue: 14900, expenses: 9100 },
    { label: 'Sat', revenue: 16500, expenses: 9600 },
    { label: 'Sun', revenue: 12100, expenses: 7600 },
  ],
  'Week 2': [
    { label: 'Mon', revenue: 9400, expenses: 6000 },
    { label: 'Tue', revenue: 10800, expenses: 7000 },
    { label: 'Wed', revenue: 11800, expenses: 7300 },
    { label: 'Thu', revenue: 13200, expenses: 8100 },
    { label: 'Fri', revenue: 15600, expenses: 9400 },
    { label: 'Sat', revenue: 17100, expenses: 10100 },
    { label: 'Sun', revenue: 12900, expenses: 7900 },
  ],
  'Week 3': [
    { label: 'Mon', revenue: 8600, expenses: 5600 },
    { label: 'Tue', revenue: 9700, expenses: 6400 },
    { label: 'Wed', revenue: 11000, expenses: 7000 },
    { label: 'Thu', revenue: 12100, expenses: 7600 },
    { label: 'Fri', revenue: 13800, expenses: 8700 },
    { label: 'Sat', revenue: 15900, expenses: 9300 },
    { label: 'Sun', revenue: 11600, expenses: 7300 },
  ],
  'Week 4': [
    { label: 'Mon', revenue: 10100, expenses: 6300 },
    { label: 'Tue', revenue: 11700, expenses: 7300 },
    { label: 'Wed', revenue: 12600, expenses: 7800 },
    { label: 'Thu', revenue: 13400, expenses: 8200 },
    { label: 'Fri', revenue: 16400, expenses: 9800 },
    { label: 'Sat', revenue: 17900, expenses: 10500 },
    { label: 'Sun', revenue: 13600, expenses: 8100 },
  ],
};

const monthlyProfitData: ProfitTimelineData = {
  January: [
    { label: 'Week 1', revenue: 68000, expenses: 43200 },
    { label: 'Week 2', revenue: 72000, expenses: 45500 },
    { label: 'Week 3', revenue: 70500, expenses: 44800 },
    { label: 'Week 4', revenue: 76000, expenses: 47200 },
  ],
  February: [
    { label: 'Week 1', revenue: 65000, expenses: 42000 },
    { label: 'Week 2', revenue: 69400, expenses: 43600 },
    { label: 'Week 3', revenue: 71000, expenses: 44500 },
    { label: 'Week 4', revenue: 74800, expenses: 46300 },
  ],
  March: [
    { label: 'Week 1', revenue: 70200, expenses: 44100 },
    { label: 'Week 2', revenue: 73900, expenses: 45800 },
    { label: 'Week 3', revenue: 78300, expenses: 48000 },
    { label: 'Week 4', revenue: 80900, expenses: 49700 },
  ],
  April: [
    { label: 'Week 1', revenue: 74100, expenses: 45900 },
    { label: 'Week 2', revenue: 79500, expenses: 48600 },
    { label: 'Week 3', revenue: 81200, expenses: 49800 },
    { label: 'Week 4', revenue: 85600, expenses: 52100 },
  ],
  May: [
    { label: 'Week 1', revenue: 76000, expenses: 46800 },
    { label: 'Week 2', revenue: 80400, expenses: 49100 },
    { label: 'Week 3', revenue: 83500, expenses: 50700 },
    { label: 'Week 4', revenue: 88000, expenses: 53100 },
  ],
};

const yearlyProfitData: ProfitTimelineData = {
  2022: [
    { label: 'Q1', revenue: 520000, expenses: 344000 },
    { label: 'Q2', revenue: 558000, expenses: 362000 },
    { label: 'Q3', revenue: 602000, expenses: 388000 },
    { label: 'Q4', revenue: 634000, expenses: 404000 },
  ],
  2023: [
    { label: 'Q1', revenue: 570000, expenses: 366000 },
    { label: 'Q2', revenue: 619000, expenses: 392000 },
    { label: 'Q3', revenue: 655000, expenses: 412000 },
    { label: 'Q4', revenue: 701000, expenses: 435000 },
  ],
  2024: [
    { label: 'Q1', revenue: 610000, expenses: 385000 },
    { label: 'Q2', revenue: 668000, expenses: 418000 },
    { label: 'Q3', revenue: 724000, expenses: 446000 },
    { label: 'Q4', revenue: 776000, expenses: 475000 },
  ],
  2025: [
    { label: 'Q1', revenue: 690000, expenses: 425000 },
    { label: 'Q2', revenue: 745000, expenses: 452000 },
    { label: 'Q3', revenue: 791000, expenses: 481000 },
    { label: 'Q4', revenue: 842000, expenses: 509000 },
  ],
};

const periodMap: Record<Period, TimelineData> = {
  weekly: weeklyData,
  monthly: monthlyData,
  yearly: yearlyData,
};

const profitPeriodMap: Record<Period, ProfitTimelineData> = {
  weekly: weeklyProfitData,
  monthly: monthlyProfitData,
  yearly: yearlyProfitData,
};

const periodLabel: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectionA, setSelectionA] = useState('April');
  const [selectionB, setSelectionB] = useState('January');
  const [profitSelection, setProfitSelection] = useState('April');

  const options = useMemo(() => Object.keys(periodMap[period]), [period]);

  const safeSelectionA = options.includes(selectionA) ? selectionA : options[0];
  const safeSelectionB = options.includes(selectionB)
    ? selectionB
    : options[Math.min(1, options.length - 1)];

  const comparisonData = useMemo(() => {
    const seriesA = periodMap[period][safeSelectionA] ?? [];
    const seriesB = periodMap[period][safeSelectionB] ?? [];
    const maxLength = Math.max(seriesA.length, seriesB.length);

    return Array.from({ length: maxLength }).map((_, index) => {
      const itemA = seriesA[index];
      const itemB = seriesB[index];
      const valueA = itemA?.sales ?? 0;
      const valueB = itemB?.sales ?? 0;

      return {
        label: itemA?.label ?? itemB?.label ?? `Point ${index + 1}`,
        timelineA: valueA,
        timelineB: valueB,
        delta: valueA - valueB,
      };
    });
  }, [period, safeSelectionA, safeSelectionB]);

  const totals = useMemo(() => {
    const totalA = comparisonData.reduce((acc, item) => acc + item.timelineA, 0);
    const totalB = comparisonData.reduce((acc, item) => acc + item.timelineB, 0);
    const absoluteDiff = totalA - totalB;
    const growth = totalB === 0 ? 0 : (absoluteDiff / totalB) * 100;

    return { totalA, totalB, absoluteDiff, growth };
  }, [comparisonData]);

  const safeProfitSelection = options.includes(profitSelection)
    ? profitSelection
    : options[0];

  const profitMarginData = useMemo(() => {
    const source = profitPeriodMap[period][safeProfitSelection] ?? [];
    return source.map((item) => {
      const profit = item.revenue - item.expenses;
      const margin = item.revenue === 0 ? 0 : (profit / item.revenue) * 100;
      return {
        ...item,
        profit,
        margin,
      };
    });
  }, [period, safeProfitSelection]);

  const profitMarginStats = useMemo(() => {
    const totalRevenue = profitMarginData.reduce((acc, item) => acc + item.revenue, 0);
    const totalExpenses = profitMarginData.reduce((acc, item) => acc + item.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const averageMargin = totalRevenue === 0 ? 0 : (totalProfit / totalRevenue) * 100;
    const bestPoint = profitMarginData.reduce(
      (best, item) => (item.margin > best.margin ? item : best),
      profitMarginData[0] ?? { label: '-', margin: 0 },
    );
    const lowestPoint = profitMarginData.reduce(
      (lowest, item) => (item.margin < lowest.margin ? item : lowest),
      profitMarginData[0] ?? { label: '-', margin: 0 },
    );

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      averageMargin,
      bestPoint,
      lowestPoint,
    };
  }, [profitMarginData]);

  const handlePeriodChange = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    const nextOptions = Object.keys(periodMap[nextPeriod]);
    setSelectionA(nextOptions[0] ?? '');
    setSelectionB(nextOptions[Math.min(1, nextOptions.length - 1)] ?? '');
    setProfitSelection(nextOptions[0] ?? '');
  };

  return (
    <div className="space-y-4 pb-8">
      <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-500 dark:text-zinc-400">
              Analytics
            </p>
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-zinc-100">
              Comparative Sales Performance
            </h2>
            <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
              Compare two timelines by {periodLabel[period].toLowerCase()} sales using static business data.
            </p>
          </div>
          <div className="flex gap-2">
            {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handlePeriodChange(item)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                  period === item
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                    : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                }`}
              >
                {periodLabel[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
              Timeline A
            </span>
            <select
              value={safeSelectionA}
              onChange={(event) => setSelectionA(event.target.value)}
              className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
              Timeline B
            </span>
            <select
              value={safeSelectionB}
              onChange={(event) => setSelectionB(event.target.value)}
              className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-zinc-300 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Total A</p>
            <p className="font-semibold">{money.format(totals.totalA)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Total B</p>
            <p className="font-semibold">{money.format(totals.totalB)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Difference</p>
            <p className={`font-semibold ${totals.absoluteDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {money.format(totals.absoluteDiff)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Growth</p>
            <p className={`font-semibold ${totals.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.growth.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="h-[340px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [money.format(value), name]}
                labelStyle={{ color: '#111827', fontSize: 12 }}
                contentStyle={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxShadow: 'none',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="timelineA"
                name={safeSelectionA}
                stroke="#111827"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="timelineB"
                name={safeSelectionB}
                stroke="#9CA3AF"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Profit Margin Analysis
            </h3>
            <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
              Revenue vs expenses with margin trend for the selected {periodLabel[period].toLowerCase()} timeline.
            </p>
          </div>
          <label className="block w-full md:w-52">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
              Analysis Range
            </span>
            <select
              value={safeProfitSelection}
              onChange={(event) => setProfitSelection(event.target.value)}
              className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Revenue</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(profitMarginStats.totalRevenue)}</p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Expenses</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(profitMarginStats.totalExpenses)}</p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Net Profit</p>
            <p className="text-xs font-semibold text-green-600">{money.format(profitMarginStats.totalProfit)}</p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Avg Margin</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{profitMarginStats.averageMargin.toFixed(1)}%</p>
          </div>
        </div>

        <div className="h-[360px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={profitMarginData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                yAxisId="amount"
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                yAxisId="margin"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                domain={[0, 50]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Margin %') return [`${value.toFixed(1)}%`, name];
                  return [money.format(value), name];
                }}
                labelStyle={{ color: '#111827', fontSize: 12 }}
                contentStyle={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxShadow: 'none',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Bar
                yAxisId="amount"
                dataKey="revenue"
                name="Revenue"
                fill="#111827"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="amount"
                dataKey="expenses"
                name="Expenses"
                fill="#9CA3AF"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="margin"
                type="monotone"
                dataKey="margin"
                name="Margin %"
                stroke="#16A34A"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 text-xs text-gray-600 dark:text-zinc-300 flex flex-wrap gap-4">
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Best margin:</span>{' '}
            {profitMarginStats.bestPoint.label} ({profitMarginStats.bestPoint.margin.toFixed(1)}%)
          </p>
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Lowest margin:</span>{' '}
            {profitMarginStats.lowestPoint.label} ({profitMarginStats.lowestPoint.margin.toFixed(1)}%)
          </p>
        </div>
      </section>
    </div>
  );
}