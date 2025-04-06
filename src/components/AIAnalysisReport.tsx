import React, { useState, useEffect } from 'react';
import { Trade, UserStrategy, AIInsight } from '../types';
import { Download, FileText, ChevronDown, ChevronUp, Bot, LineChart, BarChart2, Brain, Shield, X, Lightbulb } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../utils/format';
import { getAIService } from '../lib/openai';
import { supabase } from '../lib/supabase';
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
  Bar,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

interface AIAnalysisReportProps {
  userId: string;
  trades: Trade[];
  strategies: UserStrategy[];
  dateRange: {
    start: Date;
    end: Date;
  };
  currency: string;
  onClose: () => void;
}

export default function AIAnalysisReport({ userId, trades, strategies, dateRange, currency, onClose }: AIAnalysisReportProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    generateAnalysis();
  }, []);

  const generateAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const ai = await getAIService(userId);
      
      // Generate all types of insights in parallel
      const [performance, psychology, pattern, risk] = await Promise.all([
        ai.generateInsights(trades, 'performance'),
        ai.generateInsights(trades, 'psychology'),
        ai.generateInsights(trades, 'pattern'),
        ai.generateInsights(trades, 'risk')
      ]);

      setInsights([performance, psychology, pattern, risk]);
    } catch (error) {
      console.error('Error generating analysis:', error);
      setError('Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Trading Performance Analysis', 20, 28);

    let yPos = 50;

    // Add each insight section
    insights.forEach((insight, index) => {
      // Add page break if needed
      if (yPos > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPos = 20;
      }

      // Section title
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246);
      doc.text(insight.content.title, 20, yPos);
      yPos += 10;

      // Description
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const descLines = doc.splitTextToSize(insight.content.description, pageWidth - 40);
      doc.text(descLines, 20, yPos);
      yPos += 10 * descLines.length + 10;

      // Metrics
      if (insight.content.metrics) {
        Object.entries(insight.content.metrics).forEach(([key, values]) => {
          if (!Array.isArray(values) || values.length === 0) return;

          // Add page break if needed
          if (yPos > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(14);
          doc.setTextColor(59, 130, 246);
          doc.text(key.replace(/_/g, ' ').toUpperCase(), 20, yPos);
          yPos += 10;

          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          values.forEach(value => {
            const lines = doc.splitTextToSize(`• ${value}`, pageWidth - 40);
            doc.text(lines, 20, yPos);
            yPos += 10 * lines.length;
          });

          yPos += 10;
        });
      }

      // Recommendations
      if (insight.content.recommendations?.length) {
        // Add page break if needed
        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(59, 130, 246);
        doc.text('RECOMMENDATIONS', 20, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        insight.content.recommendations.forEach(rec => {
          const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 40);
          doc.text(lines, 20, yPos);
          yPos += 10 * lines.length;
        });

        yPos += 20;
      }
    });

    // Save the PDF
    doc.save(`trading_analysis_${dateRange.start.toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Error</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Trading Performance Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-lg border p-6 ${
                insight.type === 'performance' ? 'bg-blue-50 border-blue-200' :
                insight.type === 'psychology' ? 'bg-purple-50 border-purple-200' :
                insight.type === 'pattern' ? 'bg-green-50 border-green-200' :
                'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-start space-x-4">
                {insight.type === 'performance' ? <LineChart className="h-6 w-6 text-blue-600" /> :
                 insight.type === 'psychology' ? <Brain className="h-6 w-6 text-purple-600" /> :
                 insight.type === 'pattern' ? <Lightbulb className="h-6 w-6 text-green-600" /> :
                 <Shield className="h-6 w-6 text-orange-600" />}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {insight.content.title}
                  </h3>
                  <p className="text-gray-700 mt-2">
                    {insight.content.description}
                  </p>
                </div>
              </div>

              {insight.content.metrics && Object.entries(insight.content.metrics).length > 0 && (
                <div className="mt-6 space-y-4">
                  {Object.entries(insight.content.metrics).map(([key, values]) => {
                    if (!Array.isArray(values) || values.length === 0) return null;
                    return (
                      <div key={key}>
                        <h4 className="text-sm font-medium text-gray-900 capitalize mb-2">
                          {key.replace(/_/g, ' ')}
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {values.map((item, index) => (
                            <li key={index} className="text-sm text-gray-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              {insight.content.recommendations && insight.content.recommendations.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Recommendations</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {insight.content.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-gray-600">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}