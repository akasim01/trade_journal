import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subYears, isSameDay, eachDayOfInterval, startOfMonth as getStartOfMonth, endOfMonth as getEndOfMonth, addMonths, subMonths } from 'date-fns';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Trade, UserSettings, DEFAULT_SETTINGS, DateRangePeriod } from '../types';
import DateRangeSelector from '../components/DateRangeSelector';
import ErrorDisplay from '../components/ErrorDisplay';
import { AlertTriangle, RefreshCw, LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency } from '../utils/format';

interface DashboardProps {
  user: User;
}

function Dashboard({ user }: DashboardProps) {
  const [dateRange, setDateRange] = useState({
    start: startOfWeek(new Date()),
    end: endOfWeek(new Date())
  });
  const [period, setPeriod] = useState<DateRangePeriod>('weekly');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);

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
      setError('Failed to load trades');
    }
  };

  // Memoize expensive calculations
  const {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalNetPL,
    avgWinningTrade,
    avgLosingTrade,
    profitFactor,
    tradesByTicker,
    uniqueDays,
    winningDays,
    winRateByDays,
    cumulativePLData,
    weekdayPLData
  } = useMemo(() => {
    const winningTrades = trades.filter(trade => trade.net_profit > 0);
    const losingTrades = trades.filter(trade => trade.net_profit < 0);
    const totalTrades = trades.length;
    const winRate = totalTrades ? (winningTrades.length / totalTrades) * 100 : 0;
    const totalNetPL = trades.reduce((sum, trade) => sum + trade.net_profit, 0);
    const avgWinningTrade = winningTrades.length > 0 
      ? winningTrades.reduce((sum, trade) => sum + trade.net_profit, 0) / winningTrades.length 
      : 0;
    const avgLosingTrade = losingTrades.length > 0
      ? losingTrades.reduce((sum, trade) => sum + trade.net_profit, 0) / losingTrades.length
      : 0;
    const profitFactor = Math.abs(
      winningTrades.reduce((sum, trade) => sum + trade.net_profit, 0) /
      (losingTrades.reduce((sum, trade) => sum + trade.net_profit, 0) || 1)
    );

    // Calculate trades distribution by ticker
    const tradesByTicker = trades.reduce((acc: { [key: string]: { total: number, wins: number, losses: number, totalPL: number } }, trade) => {
      if (!acc[trade.ticker]) {
        acc[trade.ticker] = { total: 0, wins: 0, losses: 0, totalPL: 0 };
      }
      acc[trade.ticker].total++;
      acc[trade.ticker].totalPL += trade.net_profit;
      if (trade.net_profit > 0) {
        acc[trade.ticker].wins++;
      } else if (trade.net_profit < 0) {
        acc[trade.ticker].losses++;
      }
      return acc;
    }, {});

    const uniqueDays = [...new Set(trades.map(trade => trade.date))];
    const winningDays = uniqueDays.filter(date => {
      // Get all trades for this date and convert entry times to local timezone
      const dayTrades = trades.filter(trade => {
        const localDate = new Date(trade.entry_time);
        return format(localDate, 'yyyy-MM-dd') === date;
      });
      
      const dayPL = dayTrades.reduce((sum, trade) => sum + trade.net_profit, 0);
      return dayPL > 0;
    });
    const winRateByDays = uniqueDays.length > 0 
      ? (winningDays.length / uniqueDays.length) * 100 
      : 0;

    // Calculate cumulative P&L data
    const cumulativePLData = trades.reduce((acc: any[], trade) => {
      // Convert UTC date to user's timezone for date calculation
      const localDate = new Date(trade.entry_time);
      const tradeDate = format(localDate, 'yyyy-MM-dd');
      const existingEntry = acc.find(entry => entry.date === tradeDate);
      
      if (existingEntry) {
        existingEntry.value += trade.net_profit;
      } else {
        const previousValue = acc.length > 0 ? acc[acc.length - 1].value : 0;
        acc.push({
          date: tradeDate,
          value: previousValue + trade.net_profit
        });
      }
      return acc;
    }, []);

    // Calculate weekday P&L data
    const weekdayPLData = trades.reduce((acc: { [key: string]: any }, trade) => {
      // Convert UTC date to user's timezone for weekday calculation
      const localDate = new Date(trade.entry_time);
      const weekday = format(localDate, 'EEEE');
      if (!acc[weekday]) {
        acc[weekday] = {
          totalPL: 0,
          tradingDays: new Set(),
          trades: 0
        };
      }
      acc[weekday].totalPL += trade.net_profit;
      acc[weekday].tradingDays.add(trade.date);
      acc[weekday].trades++;
      return acc;
    }, {});

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalNetPL,
      avgWinningTrade,
      avgLosingTrade,
      profitFactor,
      tradesByTicker,
      uniqueDays,
      winningDays,
      winRateByDays,
      cumulativePLData,
      weekdayPLData
    };
  }, [trades]);

  // Memoize chart data
  const chartData = useMemo(() => {
    const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A78BFA', '#818CF8'];

    return {
      tickerDistributionData: Object.entries(tradesByTicker)
        .map(([ticker, stats], index) => ({
          ticker,
          total: stats.total,
          wins: stats.wins,
          losses: stats.losses,
          value: stats.totalPL,
          fill: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.total - a.total),

      winRateChartData: [
        {
          name: 'Wins',
          value: winningTrades.length,
          fill: '#10B981'
        },
        {
          name: 'Losses',
          value: losingTrades.length,
          fill: '#EF4444'
        }
      ],

      dayWinRateChartData: [
        {
          name: 'Winning Days',
          value: winningDays.length,
          fill: '#10B981'
        },
        {
          name: 'Losing Days',
          value: uniqueDays.length - winningDays.length,
          fill: '#EF4444'
        }
      ],

      weekdayChartData: Object.entries(weekdayPLData)
        .map(([day, stats]: [string, any]) => ({
          day,
          value: stats.totalPL,
          tradingDays: stats.tradingDays.size,
          avgValue: stats.totalPL / stats.tradingDays.size,
          trades: stats.trades
        }))
        .sort((a, b) => {
          // Sort weekdays starting with Monday
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          return days.indexOf(a.day) - days.indexOf(b.day);
        })
    };
  }, [tradesByTicker, winningTrades.length, losingTrades.length, winningDays.length, uniqueDays.length, weekdayPLData]);


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
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <DateRangeSelector
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            period={period}
            onPeriodChange={setPeriod}
          />
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error ? (
          <ErrorDisplay message={error} onRetry={fetchTrades} />
        ) : trades.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Trades Found</h3>
            <p className="text-sm text-gray-500">
              No trading data is available for the selected period.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-500">Total Net P&L</h2>
                <p className={`text-2xl font-bold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalNetPL, settings.currency)}
                </p>
                <p className="text-xs text-gray-500">Trades: {totalTrades}</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-500">Profit Factor</h2>
                <p className="text-2xl font-bold text-blue-600">
                  {profitFactor.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Win/Loss Ratio</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-500">Avg Win</h2>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(avgWinningTrade, settings.currency)}
                </p>
                <p className="text-xs text-gray-500">Wins: {winningTrades.length}</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-500">Avg Loss</h2>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(avgLosingTrade, settings.currency)}
                </p>
                <p className="text-xs text-gray-500">Losses: {losingTrades.length}</p>
              </div>
            </div>

            {/* Win Rate Charts and P&L Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Win Rate by Trades */}
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-900">Win Rate by Trades</h2>
                <div className="h-[220px] flex flex-col items-center">
                  <div className="h-[200px] w-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.winRateChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={75}
                          outerRadius={95}
                          startAngle={180}
                          endAngle={0}
                        >
                          {chartData.winRateChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">
                        {winRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-xs mt-1">
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1"></span>
                      <span className="text-gray-600">{winningTrades.length} wins</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                      <span className="text-gray-600">{losingTrades.length} losses</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Win Rate by Days */}
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-900">Win Rate by Days</h2>
                <div className="h-[220px] flex flex-col items-center">
                  <div className="h-[200px] w-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.dayWinRateChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={75}
                          outerRadius={95}
                          startAngle={180}
                          endAngle={0}
                        >
                          {chartData.dayWinRateChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">
                        {winRateByDays.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-xs mt-1">
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1"></span>
                      <span className="text-gray-600">{winningDays.length} wins</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                      <span className="text-gray-600">{uniqueDays.length - winningDays.length} losses</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trades Distribution by Ticker */}
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-sm font-medium text-gray-900">Trades by Ticker</h2>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.tickerDistributionData}
                        dataKey="total"
                        nameKey="ticker"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {chartData.tickerDistributionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill}
                            strokeWidth={0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${props.payload.total} trades (${props.payload.wins} wins, ${props.payload.losses} losses)`,
                          `Total P&L: ${formatCurrency(props.payload.value, settings.currency)}`
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
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        formatter={(value) => value}
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* P&L Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:col-span-3">
                {/* Weekday Net P&L */}
                <div className="bg-white rounded-lg shadow p-3">
                  <h2 className="text-sm font-medium text-gray-900 mb-2">Weekday Net P&L</h2>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.weekdayChartData}>
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 11 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(value) => formatCurrency(value, settings.currency)}
                          tick={{ fontSize: 11 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: number, name, props: any) => [
                            `Days: ${props.payload.tradingDays}\n` +
                            `Trades: ${props.payload.trades}\n` +
                            `Total P&L: ${formatCurrency(props.payload.value, settings.currency)}`
                          ]}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            fontSize: '12px',
                            whiteSpace: 'pre-line'
                          }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                        >
                          {chartData.weekdayChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.value >= 0 ? '#10b981' : '#ef4444'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Daily Net Cumulative P&L */}
                <div className="bg-white rounded-lg shadow p-3">
                  <h2 className="text-sm font-medium text-gray-900 mb-2">Daily Net Cumulative P&L</h2>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cumulativePLData}>
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
                            'Cumulative P&L'
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
                          fillOpacity={1}
                          fill="url(#colorValue)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;