import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Bot, LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trade, UserStrategy, DateRangePeriod } from '../types';
import AIChat from '../components/AIChat';
import AIInsightsList from '../components/AIInsightsList';
import AIAnalysisReport from '../components/AIAnalysisReport';
import DateRangeSelector from '../components/DateRangeSelector';
import { startOfMonth, endOfMonth } from 'date-fns';

interface AIProps {
  user: User;
}

export default function AI({ user }: AIProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'insights'>('chat');
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [period, setPeriod] = useState<DateRangePeriod>('monthly');
  const [generating, setGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [settings, setSettings] = useState({ currency: 'USD' });

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [dateRange]);

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

  const fetchData = async () => {
    try {
      // Fetch trades for the selected date range
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (tradesError) throw tradesError;
      setTrades(tradesData || []);

      // Fetch strategies
      const { data: strategiesData, error: strategiesError } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (strategiesError) throw strategiesError;
      setStrategies(strategiesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (generating || !trades.length) return;
    setGenerating(true);
    setShowReport(true);
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
                <Bot className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <DateRangeSelector
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                period={period}
                onPeriodChange={setPeriod}
              />
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center h-9 px-3 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200">
                  <span className="text-gray-600 mr-2">Trades:</span>
                  <span className="font-semibold text-blue-600">{trades.length}</span>
                </div>
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={generating || !trades.length}
                  className="ml-4 flex items-center h-9 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <LineChart className="h-4 w-4 mr-1.5" />
                      Generate AI Insights
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex space-x-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'chat'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Trading Assistant
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'insights'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                AI Insights
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'chat' ? (
          <div className="bg-white rounded-lg shadow-sm p-6 max-w-7xl mx-auto">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-gray-900">AI Trading Assistant</h2>
              <p className="text-sm text-gray-600 mt-1">
                Get personalized insights, analysis, and recommendations for your trading performance.
              </p>
            </div>

            <AIChat
              userId={user.id}
              context={{
                trades,
                strategies,
                date_range: trades.length > 0 ? {
                  start: trades[trades.length - 1].date,
                  end: trades[0].date
                } : undefined
              }}
              className="min-h-[50vh]"
            />
          </div>
        ) : (
          <AIInsightsList userId={user.id} />
        )}
      </main>

      {showReport && (
        <AIAnalysisReport
          userId={user.id}
          trades={trades}
          strategies={strategies}
          dateRange={dateRange}
          currency={settings.currency}
          onClose={() => {
            setShowReport(false);
            setGenerating(false);
            setActiveTab('insights');
          }}
        />
      )}
    </div>
  );
}