import React, { useState, useEffect } from 'react';
import { TradePattern, PatternVisualizationSettings } from '../types';
import { formatCurrency } from '../utils/format';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter, Legend, ComposedChart } from 'recharts';

interface PatternVisualizationProps {
  pattern: TradePattern;
  currency: string;
  onSettingsChange?: (settings: Partial<PatternVisualizationSettings>) => void;
}

export default function PatternVisualization({
  pattern,
  currency,
  onSettingsChange
}: PatternVisualizationProps) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    generateChartData();
  }, [pattern]);

  const generateChartData = () => {
    switch (pattern.pattern_type) {
      case 'time_based':
        setChartData(generateTimeBasedData());
        break;
      case 'setup':
        setChartData(generateSetupData());
        break;
      case 'risk':
        setChartData(generateRiskData());
        break;
    }
  };

  const generateTimeBasedData = () => {
    // Format data for time-based patterns
    const hourData = Array(24).fill(0).map((_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      profit: 0,
      trades: 0,
      winRate: 0
    }));

    // Update with actual data
    if (pattern.pattern_data.avg_profit) {
      const hour = pattern.pattern_data.hour;
      hourData[hour] = {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        profit: pattern.pattern_data.avg_profit,
        trades: pattern.sample_size,
        winRate: pattern.success_rate * 100
      };
    }

    return hourData;
  };

  const generateSetupData = () => {
    // Generate setup pattern data
    const data = [];
    const { avg_profit, avg_duration } = pattern.pattern_data;
    
    // Create sample data points for visualization
    for (let i = 0; i < pattern.sample_size; i++) {
      data.push({
        index: i,
        profit: avg_profit * (0.8 + Math.random() * 0.4), // Add some variation
        confidence: pattern.confidence_score * 100,
        success: Math.random() < pattern.success_rate ? 1 : 0
      });
    }

    return data;
  };

  const generateRiskData = () => {
    switch (pattern.risk_category) {
      case 'position_size':
        return generatePositionSizeData();
      case 'drawdown':
        return generateDrawdownData();
      case 'volatility':
        return generateVolatilityData();
      case 'time_risk':
        return generateTimeRiskData();
      default:
        return [];
    }
  };

  const generatePositionSizeData = () => {
    const { avg_size = 0, size_variation = 0 } = pattern.pattern_data;
    const riskPerContract = pattern.risk_metrics?.risk_per_contract || 1;
    const data = [];
    
    // Generate distribution around average size
    for (let i = -2; i <= 2; i++) {
      const size = Math.max(1, Math.round(avg_size + (i * size_variation)));
      data.push({
        size,
        risk: size * riskPerContract,
        count: Math.round(pattern.sample_size * Math.exp(-0.5 * Math.pow(i, 2)) / 2)
      });
    }
    return data;
  };

  const generateDrawdownData = () => {
    return pattern.drawdown_metrics?.history?.map((point: any) => ({
      date: point.date,
      drawdown: point.drawdown_percentage,
      equity: point.equity
    })) || generateSampleDrawdownData();
  };

  const generateVolatilityData = () => {
    return pattern.volatility_metrics?.history?.map((point: any) => ({
      date: point.date,
      volatility: point.daily_volatility,
      returns: point.returns
    })) || generateSampleVolatilityData();
  };

  const generateTimeRiskData = () => {
    return pattern.pattern_data.trades_by_hour?.map((hour: any) => ({
      hour: `${hour.hour.toString().padStart(2, '0')}:00`,
      risk: hour.risk_amount,
      loss_rate: hour.loss_rate * 100
    })) || generateSampleTimeRiskData();
  };

  // Helper functions to generate sample data when actual data is missing
  const generateSampleDrawdownData = () => {
    const data = [];
    let equity = 10000;
    let maxEquity = equity;
    
    for (let i = 0; i < 30; i++) {
      equity += (Math.random() - 0.45) * 500;
      maxEquity = Math.max(maxEquity, equity);
      const drawdown = ((maxEquity - equity) / maxEquity) * 100;
      
      data.push({
        date: format(new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000), 'MM/dd'),
        drawdown,
        equity
      });
    }
    return data;
  };

  const generateSampleVolatilityData = () => {
    const data = [];
    let volatility = pattern.volatility_metrics?.daily_volatility || 1;
    
    for (let i = 0; i < 30; i++) {
      volatility = Math.max(0.1, volatility + (Math.random() - 0.5) * 0.2);
      const returns = (Math.random() - 0.5) * volatility * 2;
      
      data.push({
        date: format(new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000), 'MM/dd'),
        volatility,
        returns
      });
    }
    return data;
  };

  const generateSampleTimeRiskData = () => {
    return Array(24).fill(0).map((_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      risk: Math.random() * pattern.pattern_data.max_hourly_loss,
      loss_rate: Math.random() * 100
    }));
  };

  const renderChart = () => {
    switch (pattern.pattern_type) {
      case 'time_based':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="hour" />
              <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value, currency)} />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tickFormatter={(value) => `${value.toFixed(2)}%`}
              />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === 'profit') return formatCurrency(value, currency);
                  if (name === 'winRate') return `${value.toFixed(2)}%`;
                  return typeof value === 'number' ? value.toFixed(2) : value;
                }}
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
                dataKey="winRate"
                fill="#10b981"
                name="Win Rate"
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'setup':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value, currency)} />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tickFormatter={(value) => `${value.toFixed(2)}%`}
              />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === 'profit') return formatCurrency(value, currency);
                  if (name === 'confidence') return `${value.toFixed(2)}%`;
                  return typeof value === 'number' ? value.toFixed(2) : value;
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="profit"
                fill="#3b82f6"
                stroke="#2563eb"
                name="Profit"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="confidence"
                stroke="#10b981"
                name="Confidence"
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'risk':
        switch (pattern.risk_category) {
          case 'position_size':
            return (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="size" />
                  <YAxis tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value, currency)}
                  />
                  <Legend />
                  <Bar dataKey="profit" fill="#10b981" name="Average Profit" />
                  <Bar dataKey="risk" fill="#ef4444" name="Risk Amount" />
                </BarChart>
              </ResponsiveContainer>
            );

          case 'drawdown':
            return (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis 
                    tickFormatter={(value) => 
                      name === 'equity' 
                        ? formatCurrency(value, currency)
                        : `${value.toFixed(2)}%`
                    } 
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'equity') return formatCurrency(value, currency);
                      return `${value.toFixed(2)}%`;
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    fill="#ef4444"
                    stroke="#dc2626"
                    name="Drawdown %"
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    fill="#3b82f6"
                    stroke="#2563eb"
                    name="Equity"
                  />
                </AreaChart>
              </ResponsiveContainer>
            );

          case 'volatility':
            return (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `${value.toFixed(2)}%`} />
                  <Tooltip
                    formatter={(value: any) => `${value.toFixed(2)}%`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="volatility"
                    stroke="#3b82f6"
                    name="Volatility"
                  />
                  <Line
                    type="monotone"
                    dataKey="returns"
                    stroke="#10b981"
                    name="Returns"
                  />
                </LineChart>
              </ResponsiveContainer>
            );

          case 'time_risk':
            return (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value, currency)} />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tickFormatter={(value) => `${value.toFixed(2)}%`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'risk') return formatCurrency(value, currency);
                      if (name === 'loss_rate') return `${value.toFixed(2)}%`;
                      return value;
                    }}
                    labelFormatter={(label) => `Hour: ${label}`}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="risk"
                    fill="#ef4444"
                    name="Risk Amount"
                    barSize={20}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="loss_rate"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Loss Rate"
                    dot={{ fill: '#f59e0b' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            );

          default:
            return null;
        }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderChart()}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Pattern Details</h3>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Success Rate</dt>
            <dd className="text-sm font-medium text-gray-900">
              {(pattern.success_rate * 100).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Sample Size</dt>
            <dd className="text-sm font-medium text-gray-900">
              {pattern.sample_size} trades
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Confidence Score</dt>
            <dd className="text-sm font-medium text-gray-900">
              {(pattern.confidence_score * 100).toFixed(2)}%
            </dd>
          </div>
          {pattern.risk_score && (
            <div>
              <dt className="text-sm text-gray-500">Risk Score</dt>
              <dd className="text-sm font-medium text-gray-900">
                {pattern.risk_score.toFixed(2)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}