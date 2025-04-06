import React from 'react';
import { Trade } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart
} from 'recharts';
import { calculateAdvancedMetrics } from '../utils/analytics';

interface AdvancedAnalyticsProps {
  trades: Trade[];
  currency: string;
}

export default function AdvancedAnalytics({ trades, currency }: AdvancedAnalyticsProps) {
  const metrics = calculateAdvancedMetrics(trades);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-8">
      {/* Core Performance Metrics */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Core Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total ROI</h3>
            <p className={`text-2xl font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(metrics.roi)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Sharpe Ratio</h3>
            <p className="text-2xl font-bold text-blue-600">{metrics.sharpeRatio.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Sortino Ratio</h3>
            <p className="text-2xl font-bold text-blue-600">{metrics.sortinoRatio.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Max Drawdown</h3>
            <p className="text-2xl font-bold text-red-600">{formatPercent(metrics.maxDrawdown)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}