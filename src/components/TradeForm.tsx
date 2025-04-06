import React, { useState, useEffect } from 'react';
import { format, parseISO, isAfter } from 'date-fns';
import { Trade, UserTicker, UserStrategy } from '../types';
import { Plus, Save, FileText } from 'lucide-react';
import ImageUploader from './ImageUploader';
import { uploadSnapshot } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { EmbeddingsService } from '../lib/embeddings';

const DEFAULT_TICKERS = ['MES', 'ES', 'MNQ', 'NQ'];
const DEFAULT_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', 'Daily'];

interface TradeFormProps {
  onSubmit: (trade: Omit<Trade, 'duration_seconds'>) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<Trade>;
  defaultCommission: number;
  selectedDate?: Date;
}

export default function TradeForm({ onSubmit, onCancel, initialData, defaultCommission, selectedDate }: TradeFormProps) {
  const defaultDate = selectedDate || new Date();
  const [formData, setFormData] = useState({
    entry_time: initialData?.entry_time 
      ? format(new Date(initialData.entry_time), "yyyy-MM-dd'T'HH:mm") 
      : format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
    exit_time: initialData?.exit_time 
      ? format(new Date(initialData.exit_time), "yyyy-MM-dd'T'HH:mm") 
      : format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
    ticker: initialData?.ticker || DEFAULT_TICKERS[0],
    direction: initialData?.direction || 'long',
    contracts: initialData?.contracts?.toString() || '',
    profit_loss: initialData?.profit_loss?.toString() || '',
    commission_per_contract: initialData?.commission_per_contract?.toString() || defaultCommission.toString(),
    notes: initialData?.notes || '',
    snapshot_url: initialData?.snapshot_url || '',
    strategy_id: initialData?.strategy_id || '',
    entry_price: initialData?.entry_price?.toString() || '',
    stop_loss: initialData?.stop_loss?.toString() || '',
    target_price: initialData?.target_price?.toString() || '',
    timeframe: initialData?.timeframe || DEFAULT_TIMEFRAMES[0]
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customTickers, setCustomTickers] = useState<UserTicker[]>([]);
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [tickerPointValues, setTickerPointValues] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCustomTickers();
    fetchStrategies();
    fetchTickerPointValues();
  }, []);

  const fetchTickerPointValues = async () => {
    try {
      const { data, error } = await supabase
        .from('ticker_point_values')
        .select('ticker, point_value');

      if (error) throw error;
      
      const values = (data || []).reduce((acc: Record<string, number>, item) => {
        acc[item.ticker] = item.point_value;
        return acc;
      }, {});
      
      setTickerPointValues(values);
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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCustomTickers(data || []);
    } catch (error) {
      console.error('Error fetching custom tickers:', error);
    }
  };

  const fetchStrategies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  const handleImageCapture = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const url = await uploadSnapshot(user.id, file);
      setFormData(prev => ({ ...prev, snapshot_url: url }));
    } catch (error) {
      console.error('Error uploading snapshot:', error);
      alert('Failed to upload snapshot. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, snapshot_url: '' }));
  };

  const validateForm = () => {
    setError(null);

    const entryTime = parseISO(formData.entry_time);
    const exitTime = parseISO(formData.exit_time);

    if (!isAfter(exitTime, entryTime)) {
      setError('Exit time must be after entry time');
      return false;
    }

    if (!formData.contracts || !formData.profit_loss || !formData.commission_per_contract) {
      setError('Please fill in all required fields');
      return false;
    }

    if (isNaN(parseFloat(formData.contracts)) || parseInt(formData.contracts) <= 0) {
      setError('Contracts must be a positive number');
      return false;
    }

    if (isNaN(parseFloat(formData.profit_loss))) {
      setError('Profit/Loss must be a valid number');
      return false;
    }

    if (isNaN(parseFloat(formData.commission_per_contract)) || parseFloat(formData.commission_per_contract) < 0) {
      setError('Commission must be a non-negative number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setSaving(false);
      return;
    }

    const contracts = parseInt(formData.contracts) || 0;
    const profitLoss = parseFloat(formData.profit_loss) || 0;
    const commissionPerContract = parseFloat(formData.commission_per_contract) || 0;
    const entryPrice = parseFloat(formData.entry_price) || undefined;
    const stopLoss = parseFloat(formData.stop_loss) || undefined;
    const targetPrice = parseFloat(formData.target_price) || undefined;
    const netProfit = profitLoss - (contracts * commissionPerContract);
    
    const tradeData: Omit<Trade, 'duration_seconds'> = {
      ...initialData as Trade,
      entry_time: formData.entry_time,
      exit_time: formData.exit_time,
      ticker: formData.ticker,
      direction: formData.direction as 'long' | 'short',
      contracts,
      profit_loss: profitLoss,
      commission_per_contract: commissionPerContract,
      net_profit: netProfit,
      notes: formData.notes,
      snapshot_url: formData.snapshot_url,
      strategy_id: formData.strategy_id || null,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      target_price: targetPrice,
      timeframe: formData.timeframe
    };

    try {
      // Submit the trade data first
      await onSubmit(tradeData);

      // Get the latest trade to get its ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: latestTrade, error: fetchError } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_time', tradeData.entry_time)
        .eq('exit_time', tradeData.exit_time)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching latest trade:', fetchError);
      } else if (latestTrade) {
        // Create embedding for the trade
        const embeddingsService = new EmbeddingsService(user.id);
        await embeddingsService.initialize();
        await embeddingsService.createEmbedding({
          ...tradeData,
          id: latestTrade.id,
          user_id: user.id,
          created_at: new Date().toISOString(),
          duration_seconds: 0
        });
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      setError('Failed to save trade. Please try again.');
      return;
    }

    // Only close the form if everything succeeded
    onCancel();
  };

  // Combine default and custom tickers
  const allTickers = [...DEFAULT_TICKERS, ...customTickers.map(t => t.ticker)];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Entry Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Time
          </label>
          <input
            type="datetime-local"
            value={formData.entry_time}
            onChange={(e) => setFormData({...formData, entry_time: e.target.value})}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            required
          />
        </div>

        {/* Exit Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exit Time
          </label>
          <input
            type="datetime-local"
            value={formData.exit_time}
            onChange={(e) => setFormData({...formData, exit_time: e.target.value})}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            required
          />
        </div>

        {/* Ticker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ticker
          </label>
          <select
            value={formData.ticker}
            onChange={(e) => setFormData({...formData, ticker: e.target.value})}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            required
          >
            {allTickers.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>
        </div>

        {/* Strategy */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Strategy
          </label>
          <select
            value={formData.strategy_id}
            onChange={(e) => setFormData({...formData, strategy_id: e.target.value})}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
          >
            <option value="">No Strategy</option>
            {strategies.map(strategy => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timeframe
          </label>
          <select
            value={formData.timeframe}
            onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
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
              onClick={() => setFormData({...formData, direction: 'long'})}
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
              onClick={() => setFormData({...formData, direction: 'short'})}
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

        {/* Entry Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Price (Optional)
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
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder="Enter price..."
            />
          </div>
        </div>

        {/* Stop Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stop Loss (Optional)
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
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder="Enter stop loss..."
            />
          </div>
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Price (Optional)
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
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder="Enter target..."
            />
          </div>
        </div>

        {/* Contracts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contracts
          </label>
          <div className="relative">
            <input
              type="number"
              value={formData.contracts}
              onChange={(e) => setFormData({ ...formData, contracts: e.target.value })}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors p-2.5"
              required
              min="1"
              placeholder="Enter quantity..."
            />
          </div>
        </div>

        {/* Profit/Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Profit/Loss
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.profit_loss}
              onChange={(e) => setFormData({...formData, profit_loss: e.target.value})}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Commission per Contract */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commission per Contract
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.commission_per_contract}
              onChange={(e) => setFormData({...formData, commission_per_contract: e.target.value})}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Risk/Reward Display */}
        {formData.entry_price && formData.stop_loss && formData.target_price && formData.contracts && (
          <div className="md:col-span-3 grid grid-cols-2 gap-4">
            {(() => {
              const pointValue = tickerPointValues[formData.ticker] || 1;
              const entryPrice = parseFloat(formData.entry_price);
              const stopLoss = parseFloat(formData.stop_loss);
              const targetPrice = parseFloat(formData.target_price);
              const contracts = parseInt(formData.contracts);
              
              const riskPoints = Math.abs(entryPrice - stopLoss);
              const rewardPoints = Math.abs(targetPrice - entryPrice);
              
              const riskAmount = riskPoints * pointValue * contracts;
              const rewardAmount = rewardPoints * pointValue * contracts;
              const rr = rewardPoints / riskPoints;
              
              return (
                <>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="text-xs font-medium text-red-900">Risk Amount</h4>
                    <p className="text-lg font-bold text-red-600">
                      ${riskAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-red-700">
                      {riskPoints.toFixed(1)} points × ${pointValue}/point × {contracts} contracts
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-xs font-medium text-green-900">Reward Amount</h4>
                    <p className="text-lg font-bold text-green-600">
                      ${rewardAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-700">
                      {rewardPoints.toFixed(1)} points × ${pointValue}/point × {contracts} contracts
                      <span className="ml-2 font-medium">(R/R: {rr.toFixed(2)})</span>
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Notes */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            style={{ padding: '0.625rem' }}
            rows={2}
          />
        </div>

        {/* Snapshot */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trade Snapshot
          </label>
          <ImageUploader
            onImageCapture={handleImageCapture}
            previewUrl={formData.snapshot_url}
            className={`min-h-[150px] ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onRemove={handleRemoveImage}
          />
          {uploading && (
            <p className="text-sm text-blue-600 mt-2">Uploading snapshot...</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="submit"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {initialData ? (
            <>
              <Save className="h-4 w-4 inline-block mr-1.5" />
              Update Trade
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 inline-block mr-1.5" />
              Add Trade
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
