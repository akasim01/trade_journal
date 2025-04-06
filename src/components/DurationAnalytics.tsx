import React from 'react';
import { Trade, DurationStats } from '../types';
import { formatTradeDuration } from '../utils/duration';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface DurationAnalyticsProps {
  stats: DurationStats;
  currency: string;
}

export default function DurationAnalytics({ stats, currency }: DurationAnalyticsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Average Duration</h3>
          <p className="text-3xl font-bold text-blue-600">
            {formatTradeDuration(stats.averageDuration)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Short Trade Win Rate</h3>
          <p className="text-3xl font-bold text-blue-600">
            {stats.shortTradeWinRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500">Trades under 1 hour</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Long Trade Win Rate</h3>
          <p className="text-3xl font-bold text-blue-600">
            {stats.longTradeWinRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500">Trades over 1 hour</p>
        </div>
      </div>

      {/* Profit by Duration Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profit by Duration</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.profitByDuration}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="duration" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Profit']}
              />
              <Legend />
              <Bar
                dataKey="profit"
                fill="#3b82f6"
                name="Profit"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time of Day Performance */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Time of Day Performance</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.timeOfDayStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value)} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: any, name: string) =>
                  name === 'profit'
                    ? [formatCurrency(value), 'Profit']
                    : [value, 'Number of Trades']
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="profit"
                fill="#3b82f6"
                name="Profit"
              />
              <Bar
                yAxisId="right"
                dataKey="trades"
                fill="#22c55e"
                name="Number of Trades"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}