import React, { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import { TradePlan, TickerPointValue } from '../types';
import { supabase } from '../lib/supabase';

interface TradePlanFormProps {
  tradingPlanId: string;
  onSubmit: (plan: Partial<TradePlan>) => Promise<void>;
  onCancel: () => void;
  initialData?: TradePlan;
}

const DEFAULT_TICKERS = ['MES', 'ES', 'MNQ', 'NQ'];
const DEFAULT_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', 'Daily'];

interface TickerData {
  ticker: string;
  pointValue: number;
}

export default function TradePlanForm({ tradingPlanId, onSubmit, onCancel, initialData }: TradePlanFormProps) {
  const [formData, setFormData] = useState({
    ticker: initialData?.ticker || DEFAULT_TICKERS[0],
    direction: initialData?.direction || 'long',
    entry_price: initialData?.entry_price?.toString() || '',
    stop_loss: initialData?.stop_loss?.toString() || '',
    target_price: initialData?.target_price?.toString() || '',
    max_position_size: initialData?.max_position_size?.toString() || '',
    entry_criteria: initialData?.entry_criteria || '',
    exit_criteria: initialData?.exit_criteria || '',
    timeframe: initialData?.timeframe || DEFAULT_TIMEFRAMES[0]
  });
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [tickerPointValues, setTickerPointValues] = useState<TickerData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCustomTickers();
    fetchTickerPointValues();
  }, []);

  const fetchTickerPointValues = async () => {
    try {
      const { data, error } = await supabase
        .from('ticker_point_values')
        .select('ticker, point_value')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTickerPointValues(data?.map(({ ticker, point_value }) => ({
        ticker,
        pointValue: point_value
      })) || []);
    } catch (error) {
      console.error('Error fetching ticker point values:', error);
    }
  };

  const fetchCustomTickers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_tickers')
        .select('ticker')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCustomTickers(data?.map(t => t.ticker) || []);
    } catch (error) {
      console.error('Error fetching custom tickers:', error);
    }
  };

  const calculateRiskReward = () => {
    const entry = parseFloat(formData.entry_price);
    const stop = parseFloat(formData.stop_loss);
    const target = parseFloat(formData.target_price);
    const size = parseInt(formData.max_position_size);

    const tickerData = tickerPointValues.find(t => t.ticker === formData.ticker);
    if (!tickerData) {
      console.warn(`No point value found for ticker ${formData.ticker}`);
      return { risk: 0, reward: 0 };
    }

    const pointValue = tickerData.pointValue;

    if (isNaN(entry) || isNaN(stop) || isNaN(target) || isNaN(size) || isNaN(pointValue)) {
      return { risk: 0, reward: 0 };
    }

    if (formData.direction === 'long') {
      return {
        risk: (entry - stop) * size * pointValue,
        reward: (target - entry) * size * pointValue
      };
    } else {
      return {
        risk: (stop - entry) * size * pointValue,
        reward: (entry - target) * size * pointValue
      };
    }
  };

  const validateForm = () => {
    setError(null);

    const entry = parseFloat(formData.entry_price);
    const stop = parseFloat(formData.stop_loss);
    const target = parseFloat(formData.target_price);
    const size = parseInt(formData.max_position_size);

    const tickerData = tickerPointValues.find(t => t.ticker === formData.ticker);
    if (!tickerData) {
      setError(`No point value configuration found for ticker ${formData.ticker}`);
      return false;
    }

    if (isNaN(entry) || isNaN(stop) || isNaN(target) || isNaN(size)) {
      setError('Please fill in all required fields with valid numbers');
      return false;
    }

    if (size <= 0) {
      setError('Position size must be positive');
      return false;
    }

    if (formData.direction === 'long') {
      if (stop >= entry) {
        setError('Stop loss must be below entry price for long positions');
        return false;
      }
      if (target <= entry) {
        setError('Target must be above entry price for long positions');
        return false;
      }
    } else {
      if (stop <= entry) {
        setError('Stop loss must be above entry price for short positions');
        return false;
      }
      if (target >= entry) {
        setError('Target must be below entry price for short positions');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    setError(null);

    try {
      if (!validateForm()) {
        return;
      }

      const { risk, reward } = calculateRiskReward();
      
      const planData: Partial<TradePlan> = {
        ...initialData,
        trading_plan_id: tradingPlanId,
        ticker: formData.ticker,
        direction: formData.direction as 'long' | 'short',
        entry_price: parseFloat(formData.entry_price),
        stop_loss: parseFloat(formData.stop_loss),
        target_price: parseFloat(formData.target_price),
        risk_amount: risk,
        reward_amount: reward,
        max_position_size: parseInt(formData.max_position_size),
        entry_criteria: formData.entry_criteria || null,
        exit_criteria: formData.exit_criteria || null,
        timeframe: formData.timeframe || null
      };

      await onSubmit(planData);
    } catch (error) {
      console.error('Error saving trade plan:', error);
      setError('Failed to save trade plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Combine default and custom tickers
  const allTickers = [...DEFAULT_TICKERS, ...customTickers];

  const getTickerPointValue = () => {
    const tickerData = tickerPointValues.find(t => t.ticker === formData.ticker);
    return tickerData ? `$${tickerData.pointValue} per point` : 'No point value set';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ticker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ticker
          </label>
          <div>
            <select
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              {allTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">{getTickerPointValue()}</p>
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timeframe
          </label>
          <select
            value={formData.timeframe}
            onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {DEFAULT_TIMEFRAMES.map(tf => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, direction: 'long' })}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                formData.direction === 'long'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, direction: 'short' })}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                formData.direction === 'short'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Short
            </button>
          </div>
        </div>

        {/* Position Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Position Size
          </label>
          <input
            type="number"
            min="1"
            value={formData.max_position_size}
            onChange={(e) => setFormData({ ...formData, max_position_size: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            required
          />
        </div>

        {/* Entry Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Price
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.entry_price}
              onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
              required
            />
          </div>
        </div>

        {/* Stop Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stop Loss
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.stop_loss}
              onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
              required
            />
          </div>
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Price
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.target_price}
              onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
              required
            />
          </div>
        </div>

        {/* Risk/Reward Display */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-red-900">Risk Amount</h4>
            <p className="text-2xl font-bold text-red-600">
              ${calculateRiskReward().risk.toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-900">Reward Amount</h4>
            <p className="text-2xl font-bold text-green-600">
              ${calculateRiskReward().reward.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Entry Criteria */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Criteria
          </label>
          <textarea
            value={formData.entry_criteria}
            onChange={(e) => setFormData({ ...formData, entry_criteria: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            rows={2}
            placeholder="Enter your entry criteria..."
          />
        </div>

        {/* Exit Criteria */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exit Criteria
          </label>
          <textarea
            value={formData.exit_criteria}
            onChange={(e) => setFormData({ ...formData, exit_criteria: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            rows={2}
            placeholder="Enter your exit criteria..."
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Saving...
            </>
          ) : (
            <>
              {initialData ? (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  Update Trade Setup
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Trade Setup
                </>
              )}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}