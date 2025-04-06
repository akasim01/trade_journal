import React, { useState, useEffect } from 'react';
import { Trade, UserStrategy } from '../types';
import { Download, FileText, ChevronDown, ChevronUp, Bot, LineChart, BarChart2, Brain, Shield, X, Lightbulb } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../utils/format';
import { getAIService } from '../lib/openai';
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
  Legend
} from 'recharts';

interface AIInsightsReportProps {
  userId: string;
  trades: Trade[];
  strategies: UserStrategy[];
  dateRange: {
    start: Date;
    end: Date;
  };
  currency: string;
}

interface AIAnalysis {
  performance: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  strategy: {
    summary: string;
    effectiveStrategies: string[];
    improvements: string[];
    recommendations: string[];
  };
  risk: {
    summary: string;
    concerns: string[];
    positives: string[];
    recommendations: string[];
  };
  psychology: {
    summary: string;
    patterns: string[];
    improvements: string[];
    recommendations: string[];
  };
}

function AIInsightsReport({ userId, trades, strategies, dateRange, currency }: AIInsightsReportProps) {
  const [showReport, setShowReport] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate key metrics
  const totalTrades = trades.length;
  const winningTrades = trades.filter(trade => trade.net_profit > 0);
  const losingTrades = trades.filter(trade => trade.net_profit < 0);
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

  // Calculate trades by direction
  const tradesByDirection = trades.reduce((acc: { [key: string]: number }, trade) => {
    acc[trade.direction] = (acc[trade.direction] || 0) + 1;
    return acc;
  }, {});

  const directionData = [
    { name: 'Long', value: tradesByDirection['long'] || 0, fill: '#10B981' },
    { name: 'Short', value: tradesByDirection['short'] || 0, fill: '#EF4444' }
  ];

  // Calculate cumulative P&L
  const cumulativePnL = trades.reduce((acc: any[], trade, index) => {
    const previousValue = index > 0 ? acc[index - 1].value : 0;
    acc.push({
      date: trade.date,
      value: previousValue + trade.net_profit
    });
    return acc;
  }, []);

  useEffect(() => {
    if (showReport && !aiAnalysis) {
      generateAIAnalysis();
    }
  }, [showReport]);

  const generateAIAnalysis = async () => {
    if (!trades.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const ai = await getAIService(userId);
      
      // Generate performance analysis
      const performanceInsight = await ai.generateInsights(trades, 'performance');
      const strategyInsight = await ai.generateInsights(trades, 'pattern');
      const riskInsight = await ai.generateInsights(trades, 'risk');
      const psychologyInsight = await ai.generateInsights(trades, 'psychology');

      // Parse and format the insights
      const formatInsight = (insight: any) => {
        try {
          const content = typeof insight.content === 'string' 
            ? JSON.parse(insight.content) 
            : insight.content;

          return {
            summary: content.description || '',
            strengths: Array.isArray(content.metrics?.strengths) ? content.metrics.strengths : [],
            weaknesses: Array.isArray(content.metrics?.weaknesses) ? content.metrics.weaknesses : [],
            improvements: Array.isArray(content.metrics?.improvements) ? content.metrics.improvements : [],
            patterns: Array.isArray(content.metrics?.patterns) ? content.metrics.patterns : [],
            concerns: Array.isArray(content.metrics?.concerns) ? content.metrics.concerns : [],
            positives: Array.isArray(content.metrics?.positives) ? content.metrics.positives : [],
            effectiveStrategies: Array.isArray(content.metrics?.effective) ? content.metrics.effective : [],
            recommendations: Array.isArray(content.recommendations) ? content.recommendations : []
          };
        } catch (e) {
          console.error('Error parsing insight:', e);
          return {
            summary: '',
            strengths: [],
            weaknesses: [],
            improvements: [],
            patterns: [],
            concerns: [],
            positives: [],
            effectiveStrategies: [],
            recommendations: []
          };
        }
      };

      const performanceData = formatInsight(performanceInsight);
      const strategyData = formatInsight(strategyInsight);
      const riskData = formatInsight(riskInsight);
      const psychologyData = formatInsight(psychologyInsight);

      setAiAnalysis({
        performance: {
          summary: performanceData.summary,
          strengths: performanceData.strengths,
          weaknesses: performanceData.weaknesses,
          recommendations: performanceData.recommendations
        },
        strategy: {
          summary: strategyData.summary,
          effectiveStrategies: strategyData.effectiveStrategies,
          improvements: strategyData.improvements,
          recommendations: strategyData.recommendations
        },
        risk: {
          summary: riskData.summary,
          concerns: riskData.concerns,
          positives: riskData.positives,
          recommendations: riskData.recommendations
        },
        psychology: {
          summary: psychologyData.summary,
          patterns: psychologyData.patterns,
          improvements: psychologyData.improvements,
          recommendations: psychologyData.recommendations
        }
      });
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      setError('Failed to generate AI analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper function to add section header
    const addSectionHeader = (text: string, y: number, color: string) => {
      doc.setFillColor(color);
      doc.rect(40, y, 4, 20, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 50, y + 14);
      return y + 30;
    };

    // Title
    doc.setFillColor(35, 82, 150);
    doc.rect(0, 0, pageWidth, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Trading Performance Analysis', 40, 40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`, 40, 60);

    let yPos = 100;

    // Key Metrics
    yPos = addSectionHeader('Key Performance Metrics', yPos, '#3B82F6');
    
    const metrics = [
      ['Total Trades', totalTrades.toString()],
      ['Win Rate', `${winRate.toFixed(1)}%`],
      ['Total P&L', formatCurrency(totalNetPL, currency)],
      ['Average Win', formatCurrency(avgWinningTrade, currency)],
      ['Average Loss', formatCurrency(avgLosingTrade, currency)],
      ['Profit Factor', profitFactor.toFixed(2)]
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: metrics,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 12,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      }
    });

    yPos = (doc.lastAutoTable?.finalY || yPos) + 20;

    // AI Analysis Sections
    if (aiAnalysis) {
      const sections = [
        {
          title: 'Performance Analysis',
          color: '#3B82F6',
          content: [
            aiAnalysis.performance.summary,
            '\nStrengths:',
            ...aiAnalysis.performance.strengths.map(s => `• ${s}`),
            '\nAreas for Improvement:',
            ...aiAnalysis.performance.weaknesses.map(w => `• ${w}`),
            '\nRecommendations:',
            ...aiAnalysis.performance.recommendations.map(r => `• ${r}`)
          ]
        },
        {
          title: 'Strategy Analysis',
          color: '#10B981',
          content: [
            aiAnalysis.strategy.summary,
            '\nMost Effective Strategies:',
            ...aiAnalysis.strategy.effectiveStrategies.map(s => `• ${s}`),
            '\nAreas for Improvement:',
            ...aiAnalysis.strategy.improvements.map(i => `• ${i}`),
            '\nRecommendations:',
            ...aiAnalysis.strategy.recommendations.map(r => `• ${r}`)
          ]
        },
        {
          title: 'Risk Management Analysis',
          color: '#EF4444',
          content: [
            aiAnalysis.risk.summary,
            '\nKey Concerns:',
            ...aiAnalysis.risk.concerns.map(c => `• ${c}`),
            '\nPositive Aspects:',
            ...aiAnalysis.risk.positives.map(p => `• ${p}`),
            '\nRecommendations:',
            ...aiAnalysis.risk.recommendations.map(r => `• ${r}`)
          ]
        },
        {
          title: 'Trading Psychology Analysis',
          color: '#8B5CF6',
          content: [
            aiAnalysis.psychology.summary,
            '\nBehavioral Patterns:',
            ...aiAnalysis.psychology.patterns.map(p => `• ${p}`),
            '\nAreas for Improvement:',
            ...aiAnalysis.psychology.improvements.map(i => `• ${i}`),
            '\nRecommendations:',
            ...aiAnalysis.psychology.recommendations.map(r => `• ${r}`)
          ]
        }
      ];

      sections.forEach(section => {
        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = 40;
        }

        yPos = addSectionHeader(section.title, yPos, section.color);
        
        section.content.forEach(line => {
          const lines = doc.splitTextToSize(line, pageWidth - 80);
          doc.setFontSize(10);
          doc.setFont('helvetica', line.startsWith('•') ? 'normal' : 'bold');
          doc.text(lines, 40, yPos);
          yPos += 10 * lines.length;
          
          if (yPos > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            yPos = 40;
          }
        });
        
        yPos += 20;
      });
    }

    // Save the PDF
    doc.save(`ai_trading_analysis_${dateRange.start.toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Bot className="h-4 w-4 mr-1.5" />
          Generate AI Analysis
        </button>
      </div>

      {showReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Trading Performance Analysis</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGeneratePDF}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="flex items-center p-2 text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                  <p className="text-red-700">{error}</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center gap-3 mb-2">
                        <LineChart className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Performance</h3>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Total P&L</p>
                          <p className={`text-xl font-bold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalNetPL, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Win Rate</p>
                          <p className="text-xl font-bold text-blue-600">{winRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <div className="flex items-center gap-3 mb-2">
                        <BarChart2 className="h-5 w-5 text-green-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Trade Analysis</h3>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Average Win</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(avgWinningTrade, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Average Loss</p>
                          <p className="text-xl font-bold text-red-600">
                            {formatCurrency(avgLosingTrade, currency)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <div className="flex items-center gap-3 mb-2">
                        <Brain className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Risk Metrics</h3>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Profit Factor</p>
                          <p className="text-xl font-bold text-purple-600">{profitFactor.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Total Trades</p>
                          <p className="text-xl font-bold text-purple-600">{totalTrades}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Equity Curve */}
                    <div className="bg-white rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Equity Curve</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cumulativePnL}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis tickFormatter={(value) => formatCurrency(value, currency)} />
                            <Tooltip
                              formatter={(value: number) => [formatCurrency(value, currency), 'Account Value']}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#3b82f6"
                              fillOpacity={1}
                              fill="url(#colorValue)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Trade Direction Distribution */}
                    <div className="bg-white rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Trade Direction Distribution</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={directionData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                            >
                              {directionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis Sections */}
                  {aiAnalysis && (
                    <div className="space-y-6">
                      {/* Performance Analysis */}
                      <div className="bg-blue-50 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <LineChart className="h-6 w-6 text-blue-600" />
                          <h3 className="text-xl font-semibold text-gray-900">Performance Analysis</h3>
                        </div>
                        <div className="prose prose-blue max-w-none">
                          <p className="text-gray-700">{aiAnalysis.performance.summary}</p>
                          
                          <h4 className="text-lg font-medium text-gray-900 mt-4">Strengths</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.performance.strengths.map((strength, index) => (
                              <li key={index} className="text-gray-600">{strength}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Areas for Improvement</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.performance.weaknesses.map((weakness, index) => (
                              <li key={index} className="text-gray-600">{weakness}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Recommendations</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.performance.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-600">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Strategy Analysis */}
                      <div className="bg-green-50 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Lightbulb className="h-6 w-6 text-green-600" />
                          <h3 className="text-xl font-semibold text-gray-900">Strategy Analysis</h3>
                        </div>
                        <div className="prose prose-green max-w-none">
                          <p className="text-gray-700">{aiAnalysis.strategy.summary}</p>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Most Effective Strategies</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.strategy.effectiveStrategies.map((strategy, index) => (
                              <li key={index} className="text-gray-600">{strategy}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Areas for Improvement</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.strategy.improvements.map((improvement, index) => (
                              <li key={index} className="text-gray-600">{improvement}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Recommendations</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.strategy.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-600">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Risk Management Analysis */}
                      <div className="bg-red-50 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Shield className="h-6 w-6 text-red-600" />
                          <h3 className="text-xl font-semibold text-gray-900">Risk Management Analysis</h3>
                        </div>
                        <div className="prose prose-red max-w-none">
                          <p className="text-gray-700">{aiAnalysis.risk.summary}</p>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Key Risk Concerns</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.risk.concerns.map((concern, index) => (
                              <li key={index} className="text-gray-600">{concern}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Positive Risk Management Aspects</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.risk.positives.map((positive, index) => (
                              <li key={index} className="text-gray-600">{positive}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Recommendations</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.risk.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-600">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Trading Psychology Analysis */}
                      <div className="bg-purple-50 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Brain className="h-6 w-6 text-purple-600" />
                          <h3 className="text-xl font-semibold text-gray-900">Trading Psychology Analysis</h3>
                        </div>
                        <div className="prose prose-purple max-w-none">
                          <p className="text-gray-700">{aiAnalysis.psychology.summary}</p>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Behavioral Patterns</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.psychology.patterns.map((pattern, index) => (
                              <li key={index} className="text-gray-600">{pattern}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Areas for Improvement</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.psychology.improvements.map((improvement, index) => (
                              <li key={index} className="text-gray-600">{improvement}</li>
                            ))}
                          </ul>

                          <h4 className="text-lg font-medium text-gray-900 mt-4">Recommendations</h4>
                          <ul className="mt-2 space-y-1">
                            {aiAnalysis.psychology.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-600">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIInsightsReport;