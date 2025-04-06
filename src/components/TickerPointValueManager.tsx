import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { TickerPointValue, UserTicker } from '../types';
import { supabase } from '../lib/supabase';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface TickerPointValueManagerProps {
  tickerValues: TickerPointValue[];
  onAdd: (ticker: string, pointValue: number) => Promise<void>;
  onDelete: (tickerId: string) => Promise<void>;
}

export default function TickerPointValueManager({ tickerValues, onAdd, onDelete }: TickerPointValueManagerProps) {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [newPointValue, setNewPointValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingTicker, setDeletingTicker] = useState<TickerPointValue | null>(null);
  const [customTickers, setCustomTickers] = useState<UserTicker[]>([]);

  // Default system tickers
  const DEFAULT_TICKERS = ['ES', 'MES', 'NQ', 'MNQ'];

  useEffect(() => {
    fetchCustomTickers();
  }, []);

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

  // Get available tickers that don't have point values yet
  const getAvailableTickers = () => {
    const existingTickers = new Set(tickerValues.map(t => t.ticker));
    const allTickers = [...DEFAULT_TICKERS, ...customTickers.map(t => t.ticker)];
    return allTickers.filter(t => !existingTickers.has(t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ticker = selectedTicker.trim();
    const pointValue = parseFloat(newPointValue);

    if (!ticker) {
      setError('Please enter a ticker symbol');
      return;
    }

    if (isNaN(pointValue) || pointValue <= 0) {
      setError('Point value must be a positive number');
      return;
    }

    try {
      await onAdd(ticker, pointValue);
      setSelectedTicker('');
      setNewPointValue('');
    } catch (error) {
      setError('Failed to add ticker');
    }
  };

  const handleDeleteClick = (ticker: TickerPointValue) => {
    setDeletingTicker(ticker);
  };

  const handleDeleteConfirm = async () => {
    if (deletingTicker) {
      await onDelete(deletingTicker.id);
      setDeletingTicker(null);
    }
  };

  const availableTickers = getAvailableTickers();

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors p-2.5"
              required
            >
              <option value="">Select a ticker...</option>
              {availableTickers.length > 0 ? (
                <>
                  {DEFAULT_TICKERS.filter(t => availableTickers.includes(t)).length > 0 && (
                    <optgroup label="System Tickers">
                      {DEFAULT_TICKERS
                        .filter(t => availableTickers.includes(t))
                        .map(ticker => (
                          <option key={ticker} value={ticker}>{ticker}</option>
                        ))
                      }
                    </optgroup>
                  )}
                  {customTickers
                    .filter(t => availableTickers.includes(t.ticker))
                    .length > 0 && (
                    <optgroup label="Custom Tickers">
                      {customTickers
                        .filter(t => availableTickers.includes(t.ticker))
                        .map(ticker => (
                          <option key={ticker.id} value={ticker.ticker}>{ticker.ticker}</option>
                        ))
                      }
                    </optgroup>
                  )}
                </>
              ) : (
                <option value="" disabled>No available tickers</option>
              )}
            </select>
          </div>
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={newPointValue}
                onChange={(e) => setNewPointValue(e.target.value)}
                placeholder="Point value"
                className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors p-2.5"
                required
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={!selectedTicker || !newPointValue}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </button>
      </form>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-2">
        {tickerValues.map((ticker) => (
          <div
            key={ticker.id}
            className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2"
          >
            <div>
              <span className="text-sm font-medium text-gray-900">{ticker.ticker}</span>
              <span className="ml-2 text-sm text-gray-600">${ticker.point_value} per point</span>
              {ticker.is_system && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  System
                </span>
              )}
            </div>
            {!ticker.is_system && (
              <button
                onClick={() => handleDeleteClick(ticker)}
                className="text-gray-500 hover:text-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {deletingTicker && (
        <DeleteConfirmationDialog
          title="Delete Ticker"
          message={`Are you sure you want to delete the ticker "${deletingTicker.ticker}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTicker(null)}
        />
      )}
    </div>
  );
}