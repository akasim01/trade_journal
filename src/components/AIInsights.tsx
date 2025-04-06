import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, AlertTriangle, Trash2, X } from 'lucide-react';
import { AIInsight, Trade } from '../types';
import { getAIService } from '../lib/openai';
import { supabase } from '../lib/supabase';

interface AIInsightsProps {
  userId: string;
  trades: Trade[];
  className?: string;
}

export default function AIInsights({ userId, trades, className = '' }: AIInsightsProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAIConfig, setHasAIConfig] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  useEffect(() => {
    checkAIConfig();
    fetchInsights();
  }, []);

  const checkAIConfig = async () => {
    const { data } = await supabase
      .from('user_ai_configs')
      .select('api_key')
      .eq('user_id', userId)
      .maybeSingle();

    setHasAIConfig(!!data);
  };

  const fetchInsights = async () => {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching insights:', error);
      return;
    }

    setInsights(data || []);
  };

  const generateInsight = async (type: AIInsight['type']) => {
    if (trades.length === 0) {
      setError('No trades available for analysis');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ai = await getAIService(userId);
      const insight = await ai.generateInsights(trades, type);
      setInsights(prev => [insight, ...prev]);
    } catch (error) {
      console.error('Error generating insight:', error);
      setError('Failed to generate insight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .delete()
        .eq('id', insightId)
        .eq('user_id', userId);

      if (error) throw error;

      setInsights(prev => prev.filter(insight => insight.id !== insightId));
      setSelectedInsightId(null);
    } catch (error) {
      console.error('Error deleting insight:', error);
      setError('Failed to delete insight');
    }
  };

  const handleClearInsights = async () => {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setInsights([]);
    } catch (error) {
      console.error('Error clearing insights:', error);
      setError('Failed to clear insights');
    }
  };

  if (!hasAIConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Bot className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Insights Not Available</h3>
        <p className="text-sm text-gray-600 mb-4">
          To use AI insights, please add your OpenAI API key in the settings.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => generateInsight('performance')}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Bot className="h-5 w-5 mr-2" />
            )}
            Generate Performance Insight
          </button>
          <button
            onClick={() => generateInsight('psychology')}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Bot className="h-5 w-5 mr-2" />
            )}
            Generate Psychology Insight
          </button>
          <button
            onClick={() => generateInsight('pattern')}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Bot className="h-5 w-5 mr-2" />
            )}
            Generate Pattern Insight
          </button>
          <button
            onClick={() => generateInsight('risk')}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Bot className="h-5 w-5 mr-2" />
            )}
            Generate Risk Insight
          </button>
        </div>
        <button
          onClick={handleClearInsights}
          className="flex items-center px-4 py-2 text-gray-700 hover:text-red-600 transition-colors"
          title="Clear all insights"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear All
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="bg-white rounded-lg shadow p-6 border border-gray-200 group relative"
            onMouseEnter={() => setSelectedInsightId(insight.id)}
            onMouseLeave={() => setSelectedInsightId(null)}
          >
            {selectedInsightId === insight.id && (
              <button
                onClick={() => handleDeleteInsight(insight.id)}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete insight"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {insight.content.title}
                </h3>
                <p className="text-gray-600 mb-4 whitespace-pre-wrap">
                  {insight.content.description}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                insight.type === 'performance' ? 'bg-blue-100 text-blue-800' :
                insight.type === 'psychology' ? 'bg-purple-100 text-purple-800' :
                insight.type === 'pattern' ? 'bg-green-100 text-green-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {insight.type}
              </span>
            </div>

            {insight.content.metrics && Object.keys(insight.content.metrics).length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(insight.content.metrics).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded-lg">
                    <dt className="text-sm font-medium text-gray-500">{key}</dt>
                    <dd className="mt-1 text-lg font-semibold text-gray-900">{value}</dd>
                  </div>
                ))}
              </div>
            )}

            {insight.content.recommendations && insight.content.recommendations.length > 0 && (
              <div className="mt-4">
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
  );
}