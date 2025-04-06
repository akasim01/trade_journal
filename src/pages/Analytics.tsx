import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, subYears, parseISO, startOfWeek, endOfWeek, differenceInSeconds, differenceInMinutes, isWeekend } from 'date-fns';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Trade, UserSettings, DEFAULT_SETTINGS, DateRangePeriod } from '../types';
import { ChevronLeft, AlertTriangle, RefreshCw, LineChart as LineChartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import DateRangeSelector from '../components/DateRangeSelector';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import { calculateAdvancedMetrics } from '../utils/analytics';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart,
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
} from 'recharts';
import { formatCurrency } from '../utils/format';
import { calculateDurationStats } from '../utils/duration';

interface AnalyticsProps {
  user: User;
}

function Analytics({ user }: AnalyticsProps) {
  const today = new Date();
  const [dateRange, setDateRange] = useState({
    start: startOfWeek(today),
    end: endOfWeek(today)
  });
  const [period, setPeriod] = useState<DateRangePeriod>('weekly');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stats = calculateAdvancedMetrics(trades);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchTrades();
    }
  }, [dateRange, settings]);

  const fetchSettings = async () => {
    try {
      const { data: existingSettings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };


  const calculateTradingFrequency = (trades: Trade[]): number => {
    if (trades.length < 2) return 0;

    const tradesByDate: { [key: string]: Trade[] } = {};
    
    trades.forEach(trade => {
      const date = trade.date;
      if (!tradesByDate[date]) {
        tradesByDate[date] = [];
      }
      tradesByDate[date].push(trade);
    });

    let totalMinutes = 0;
    let totalIntervals = 0;

    Object.entries(tradesByDate).forEach(([date, dayTrades]) => {
      const sortedTrades = dayTrades
        .sort((a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime())
        .filter(trade => {
          const tradeDate = new Date(trade.entry_time);
          if (isWeekend(tradeDate)) return false;

          const hours = tradeDate.getHours();
          const minutes = tradeDate.getMinutes();
          const timeInMinutes = hours * 60 + minutes;

          return timeInMinutes >= 8.5 * 60 && timeInMinutes <= 15 * 60;
        });

      if (sortedTrades.length > 1) {
        for (let i = 1; i < sortedTrades.length; i++) {
          const minutes = differenceInMinutes(
            new Date(sortedTrades[i].entry_time),
            new Date(sortedTrades[i - 1].exit_time)
          );
          totalMinutes += minutes;
          totalIntervals++;
        }
      }
    });

    return totalIntervals > 0 ? totalMinutes / totalIntervals : 0;
  };

  const totalTrades = trades.length;
  const totalNetPL = trades.reduce((sum, trade) => sum + trade.net_profit, 0);
  const winningTrades = trades.filter(trade => trade.net_profit > 0);
  const winRate = totalTrades ? (winningTrades.length / totalTrades) * 100 : 0;
  const profitFactor = Math.abs(
    winningTrades.reduce((sum, trade) => sum + trade.net_profit, 0) /
    (trades.filter(trade => trade.net_profit < 0).reduce((sum, trade) => sum + trade.net_profit, 0) || 1)
  );

  const totalDurationSeconds = trades.reduce((sum, trade) => sum + (trade.duration_seconds || 0), 0);
  const avgTradeDurationMinutes = totalTrades > 0 ? (totalDurationSeconds / totalTrades) / 60 : 0;

  const tradingFrequency = calculateTradingFrequency(trades);

  const directionData = trades.reduce((acc: { [key: string]: number }, trade) => {
    acc[trade.direction] = (acc[trade.direction] || 0) + 1;
    return acc;
  }, {});

  const directionChartData = [
    { name: 'Long', value: directionData['long'] || 0, fill: '#10B981' },
    { name: 'Short', value: directionData['short'] || 0, fill: '#EF4444' }
  ];

  const scatterData = trades.map(trade => ({
    duration: trade.duration_seconds ? trade.duration_seconds / 60 : 0,
    pnl: trade.net_profit
  }));

  const tickerStats = Object.entries(
    trades.reduce((acc: { [key: string]: { total: number, pnl: number } }, trade) => {
      if (!acc[trade.ticker]) {
        acc[trade.ticker] = { total: 0, pnl: 0 };
      }
      acc[trade.ticker].total += 1;
      acc[trade.ticker].pnl += trade.net_profit;
      return acc;
    }, {})
  ).map(([ticker, stats]) => ({
    ticker,
    pnl: stats.pnl,
    totalTrades: stats.total
  })).sort((a, b) => b.pnl - a.pnl);

  const histogramData = (() => {
    const profits = trades.map(t => t.net_profit);
    const min = Math.min(...profits);
    const max = Math.max(...profits);
    const range = max - min;
    const bucketSize = range / 10;
    const buckets: { [key: string]: number } = {};

    // Create buckets with numeric keys first
    const numericBuckets: { [key: number]: number } = {};

    profits.forEach(profit => {
      const bucketIndex = Math.floor((profit - min) / bucketSize);
      const bucketKey = `${formatCurrency(min + bucketSize * bucketIndex, settings.currency)} to ${formatCurrency(min + bucketSize * (bucketIndex + 1), settings.currency)}`;
      buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
    });

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  })();

  const equityCurveData = trades.reduce((acc: any[], trade, index) => {
    const previousValue = index > 0 ? acc[index - 1].value : 0;
    acc.push({
      date: format(parseISO(trade.date), 'MMM d'),
      value: previousValue + trade.net_profit
    });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            </div>
            <DateRangeSelector
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              period={period}
              onPeriodChange={setPeriod}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchTrades}
                  className="mt-2 flex items-center text-sm text-red-700 hover:text-red-900"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="flex justify-center mb-4">
              <LineChartIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Trades Found</h3>
            <p className="text-sm text-gray-500">
              No trading data is available for the selected period.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <div className="bg-white rounded-lg shadow p-3">
                <h3 className="text-sm font-medium text-gray-500">Total Trades</h3>
                <p className="text-2xl font-bold text-blue-600">{totalTrades}</p>
                <p className="text-xs text-gray-500">All trades in period</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3">
                <h3 className="text-sm font-medium text-gray-500">Total Net P&L</h3>
                <p className={`text-2xl font-bold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalNetPL, settings.currency)}
                </p>
                <p className="text-xs text-gray-500">Net profit/loss</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3">
                <h3 className="text-sm font-medium text-gray-500">Win Rate</h3>
                <p className="text-2xl font-bold text-blue-600">{winRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">{winningTrades.length} winning trades</p>
              </div>

              {/* <div className="bg-white rounded-lg shadow p-3">
                <h3 className="text-sm font-medium text-gray-500">Profit Factor</h3>
                <p className="text-2xl font-bold text-blue-600">{profitFactor.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Win/Loss Ratio</p>
              </div> */}

              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-500">Avg Trade Duration</h2>
                <p className="text-2xl font-bold text-blue-600">
                {avgTradeDurationMinutes.toFixed(1)} min
                </p>
                <p className="text-xs text-gray-500">Avg duration per trade</p>
             </div>


              <div className="bg-white rounded-lg shadow p-3">
                <h3 className="text-sm font-medium text-gray-500">Trading Frequency</h3>
                <p className="text-2xl font-bold text-blue-600">{tradingFrequency.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Avg. minutes between trades</p>
              </div>
            </div>

            {/* Advanced Analytics */}
            <AdvancedAnalytics trades={trades} currency={settings.currency} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Trade Direction Distribution</h3>
                <div className="h-[300px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={directionChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        animationBegin={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      >
                        {directionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-xs mt-1">
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1"></span>
                      <span className="text-gray-600">
                        Long: {directionData['long'] || 0} trades ({((directionData['long'] || 0) / totalTrades * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                      <span className="text-gray-600">
                        Short: {directionData['short'] || 0} trades ({((directionData['short'] || 0) / totalTrades * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Duration vs Net P&L</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <XAxis
                        dataKey="duration"
                        name="Duration"
                        unit=" min"
                        type="number"
                      />
                      <YAxis
                        dataKey="pnl"
                        name="P&L"
                        tickFormatter={(value) => formatCurrency(value, settings.currency)}
                      />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          name === 'Duration' 
                            ? `${Number(value).toFixed(2)}` 
                            : formatCurrency(value, settings.currency),
                          name
                        ]}
                      />
                      <Scatter
                        name="Trades"
                        data={scatterData}
                        fill="#3b82f6"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">P&L Distribution</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData}>
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                        interval={0}
                        height={60}
                        tickFormatter={(value) => value.split(' to ')[0]}
                      />
                      <YAxis
                        tickFormatter={(value) => value.toString()}
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          value,
                          'Number of Trades'
                        ]}
                        labelFormatter={(label) => `Range: ${label}`}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          fontSize: '12px'
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      >
                        {histogramData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.range.includes('-') ? '#ef4444' : '#10b981'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">P&L by Ticker</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tickerStats} layout="vertical">
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatCurrency(value, settings.currency)}
                      />
                      <YAxis
                        dataKey="ticker"
                        type="category"
                        width={50}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          formatCurrency(value, settings.currency),
                          'Total P&L'
                        ]}
                      />
                      <Bar
                        dataKey="pnl"
                        fill="#3b82f6"
                        name="Total P&L"
                        radius={[0, 4, 4, 0]}
                      >
                        {tickerStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Equity Curve</h3>
              <div className="h-[400px]">
            </div>
            </div> */}

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Trading Performance by Time of Day</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.winRateByTime}>
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(value) => formatCurrency(value, settings.currency)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'Average P&L') return formatCurrency(value, settings.currency);
                        if (name === 'Win Rate') return `${value.toFixed(1)}%`;
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="trades"
                      fill="#94a3b8"
                      name="Number of Trades"
                      yAxisId="left"
                    />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#22c55e"
                      name="Win Rate"
                      yAxisId="right"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgPnL"
                      stroke="#3b82f6"
                      name="Average P&L"
                      yAxisId="left"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Equity Curve</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurveData}>
                    {/* Define gradients for positive and negative values */}
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value, settings.currency)}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value, settings.currency),
                        'Account Value'
                      ]}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        fontSize: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Analytics;