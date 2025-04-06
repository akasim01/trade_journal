import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Lightbulb, Brain, LineChart, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trade, TradePattern, PatternMatch, PatternVisualizationSettings } from '../types';
import { PatternAnalysisService } from '../lib/patterns';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import { formatCurrency } from '../utils/format';
import PatternVisualization from '../components/PatternVisualization';

interface InsightsProps {
  user: User;
}

export default function Insights({ user }: InsightsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<TradePattern[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [patternService] = useState(() => new PatternAnalysisService(user.id));
  const [settings, setSettings] = useState({ currency: 'USD' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<TradePattern | null>(null);

  useEffect(() => {
    initializeServices();
    fetchData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('currency')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const initializeServices = async () => {
    try {
      await patternService.initialize();
    } catch (error) {
      console.error('Error initializing services:', error);
      setError('Failed to initialize pattern analysis');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch recent trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100);

      if (tradesError) throw tradesError;
      setTrades(tradesData || []);

      // Fetch existing patterns
      const { data: patternsData, error: patternsError } = await supabase
        .from('trade_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (patternsError) throw patternsError;
      setPatterns(patternsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePatterns = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      
      // Analyze all pattern types
      const [timePatterns, setupPatterns, riskPatterns] = await Promise.all([
        patternService.analyzeTimeBasedPatterns(trades),
        patternService.analyzeSetupPatterns(trades),
        patternService.analyzeRiskPatterns(trades)
      ]);
      
      const newPatterns = [...timePatterns, ...setupPatterns, ...riskPatterns];
      setPatterns(prev => [...newPatterns, ...prev]);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      setError('Failed to analyze patterns');
    } finally {
      setAnalyzing(false);
    }
  };

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
              <div className="flex items-center">
                <Lightbulb className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-2xl font-bold text-gray-900">ML Trading Insights</h1>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Discover patterns and insights in your trading activity using Machine Learning Algorithms
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAnalyzePatterns}
                  disabled={analyzing || trades.length === 0}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze Patterns
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={patterns.length === 0}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Clear Insights
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error && (
          <div className="mb-3 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Time-based Patterns */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <LineChart className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Time-Based Patterns</h2>
            </div>
            <div className="space-y-4">
              {patterns
                .filter(p => p.pattern_type === 'time_based')
                .map(pattern => (
                  <div
                    key={pattern.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Hour {pattern.pattern_data.hour}:00
                      </h3>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {(pattern.success_rate * 100).toFixed(1)}% Success
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600">
                        Average Profit: {formatCurrency(pattern.pattern_data.avg_profit)}
                      </p>
                      <p className="text-gray-600">
                        Sample Size: {pattern.sample_size} trades
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${pattern.confidence_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {(pattern.confidence_score * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              {patterns.filter(p => p.pattern_type === 'time_based').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No time-based patterns detected yet
                </p>
              )}
            </div>
          </div>

          {/* Setup-based Patterns */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-6 w-6 text-purple-600" />
              <h2 className="text-lg font-medium text-gray-900">Setup Patterns</h2>
            </div>
            <div className="space-y-4">
              {patterns
                .filter(p => p.pattern_type === 'setup')
                .map(pattern => (
                  <div
                    key={pattern.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 transition-colors"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {pattern.setup_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <p className="text-xs text-gray-500">{pattern.pattern_data.ticker}</p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                        {(pattern.success_rate * 100).toFixed(1)}% Success
                      </span>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="text-sm">
                        <p className="text-gray-600">
                          Average Profit: {formatCurrency(pattern.pattern_data.avg_profit || 0, settings.currency)}
                        </p>
                        <p className="text-gray-600">
                          Risk/Reward: {pattern.risk_metrics?.risk_reward_ratio?.toFixed(2) || 'N/A'}
                        </p>
                      </div>
                      
                      {pattern.pattern_data.entry_conditions?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Entry Conditions:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {pattern.pattern_data.entry_conditions.map((condition, i) => (
                              <li key={i} className="flex items-center">
                                <span className="w-1 h-1 bg-purple-400 rounded-full mr-2" />
                                {condition}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${pattern.confidence_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {(pattern.confidence_score * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      
                      {pattern.pattern_tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pattern.pattern_tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
                            >
                              {tag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {patterns.filter(p => p.pattern_type === 'setup').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No setup patterns detected yet
                </p>
              )}
            </div>
          </div>

          {/* Risk Patterns */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-medium text-gray-900">Risk Patterns</h2>
            </div>
            <div className="space-y-4">
              {patterns
                .filter(p => p.pattern_type === 'risk')
                .map(pattern => (
                  <div
                    key={pattern.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-green-500 transition-colors"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {pattern.risk_category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <div className="flex items-center mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${
                                pattern.risk_score > 70 ? 'bg-red-600' :
                                pattern.risk_score > 50 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${pattern.risk_score}%` }}
                            />
                          </div>
                          <span className="ml-2 text-xs font-medium text-gray-500">
                            {pattern.risk_score.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {pattern.risk_category === 'position_size' && (
                        <>
                          <p className="text-sm text-gray-600">
                            Average Size: {pattern.pattern_data.avg_size?.toFixed(1) || '0'} contracts
                          </p>
                          <p className="text-sm text-gray-600">
                            Size Variation: {(pattern.volatility_metrics?.size_volatility * 100)?.toFixed(1) || '0'}%
                          </p>
                        </>
                      )}

                      {pattern.risk_category === 'drawdown' && (
                        <>
                          <p className="text-sm text-gray-600">
                            Max Drawdown: {pattern.drawdown_metrics?.drawdown_percentage?.toFixed(1) || '0'}%
                          </p>
                          <p className="text-sm text-gray-600">
                            Consecutive Losses: {pattern.pattern_data.max_consecutive_losses || 0}
                          </p>
                        </>
                      )}

                      {pattern.risk_category === 'volatility' && (
                        <>
                          <p className="text-sm text-gray-600">
                            Daily Volatility: {pattern.volatility_metrics?.daily_volatility?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Sharpe Ratio: {pattern.pattern_data.sharpe_ratio?.toFixed(2) || 'N/A'}
                          </p>
                        </>
                      )}

                      {pattern.risk_category === 'time_risk' && (
                        <>
                          <p className="text-sm text-gray-600">
                            Riskiest Hour: {pattern.pattern_data.riskiest_hour || 0}:00
                          </p>
                          <p className="text-sm text-gray-600">
                            Max Hourly Loss: {formatCurrency(Math.abs(pattern.pattern_data.max_hourly_loss || 0), settings.currency)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              {patterns.filter(p => p.pattern_type === 'risk').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No risk patterns detected yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pattern Visualization Modal */}
        {selectedPattern && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Pattern Analysis
                </h2>
                <button
                  onClick={() => setSelectedPattern(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <PatternVisualization
                pattern={selectedPattern}
                currency={settings.currency}
                onSettingsChange={async (settings) => {
                  try {
                    const { error } = await supabase
                      .from('trade_patterns')
                      .update({ visualization_config: settings })
                      .eq('id', selectedPattern.id);

                    if (error) throw error;
                  } catch (error) {
                    console.error('Error updating visualization settings:', error);
                  }
                }}
              />
            </div>
          </div>
        )}
      </main>

      {showClearConfirm && (
        <DeleteConfirmationDialog
          title="Clear All Insights"
          message="Are you sure you want to clear all insights? This action cannot be undone."
          onConfirm={async () => {
            try {
              const { error } = await supabase
                .from('trade_patterns')
                .delete()
                .eq('user_id', user.id);
              
              if (error) throw error;
              setPatterns([]);
            } catch (error) {
              console.error('Error clearing patterns:', error);
              setError('Failed to clear patterns');
            } finally {
              setShowClearConfirm(false);
            }
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}