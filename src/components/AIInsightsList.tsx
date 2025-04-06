import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AIInsight } from '../types';
import { LineChart, Brain, Lightbulb, Shield, X, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AIInsightsListProps {
  userId: string;
}

const AIInsightsList: React.FC<AIInsightsListProps> = ({ userId }) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInsights(data || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
      setError('Failed to load insights');
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

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'performance':
        return <LineChart className="h-6 w-6 text-blue-600" />;
      case 'psychology':
        return <Brain className="h-6 w-6 text-purple-600" />;
      case 'pattern':
        return <Lightbulb className="h-6 w-6 text-green-600" />;
      case 'risk':
        return <Shield className="h-6 w-6 text-orange-600" />;
      default:
        return <Lightbulb className="h-6 w-6 text-blue-600" />;
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'performance':
        return 'bg-blue-50 border-blue-200';
      case 'psychology':
        return 'bg-purple-50 border-purple-200';
      case 'pattern':
        return 'bg-green-50 border-green-200';
      case 'risk':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <X className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchInsights}
              className="mt-2 flex items-center text-sm text-red-700 hover:text-red-900"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">AI Trading Insights</h2>
        <p className="text-sm text-gray-600 mt-1">
          Automated analysis and insights about your trading performance.
        </p>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`relative rounded-lg border p-6 transition-all duration-200 group ${getInsightColor(insight.type)}`}
            onMouseEnter={() => setSelectedInsightId(insight.id)}
            onMouseLeave={() => setSelectedInsightId(null)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {getInsightIcon(insight.type)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {insight.content.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {selectedInsightId === insight.id && (
                <button
                  onClick={() => handleDeleteInsight(insight.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete insight"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="mt-4 prose prose-sm max-w-none">
              <p className="text-gray-700">{insight.content.description}</p>

              {insight.content.metrics && Object.entries(insight.content.metrics).length > 0 && (
                <div className="mt-4">
                  {Object.entries(insight.content.metrics).map(([key, values]) => {
                    if (!Array.isArray(values) || values.length === 0) return null;
                    return (
                      <div key={key} className="mb-4">
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
          </div>
        ))}

        {insights.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Yet</h3>
            <p className="text-sm text-gray-600">
              Generate insights about your trading performance using the AI Assistant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsightsList;