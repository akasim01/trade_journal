import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { UserTicker } from '../types';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface TickerManagerProps {
  tickers: UserTicker[];
  onAdd: (ticker: string) => Promise<void>;
  onDelete: (tickerId: string) => Promise<void>;
}

export default function TickerManager({ tickers, onAdd, onDelete }: TickerManagerProps) {
  const [newTicker, setNewTicker] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingTicker, setDeletingTicker] = useState<UserTicker | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ticker = newTicker.trim().toUpperCase();

    if (!ticker) {
      setError('Please enter a ticker symbol');
      return;
    }

    if (tickers.some(t => t.ticker === ticker)) {
      setError('This ticker already exists');
      return;
    }

    try {
      await onAdd(ticker);
      setNewTicker('');
    } catch (error) {
      setError('Failed to add ticker');
    }
  };

  const handleDeleteClick = (ticker: UserTicker) => {
    setDeletingTicker(ticker);
  };

  const handleDeleteConfirm = async () => {
    if (deletingTicker) {
      await onDelete(deletingTicker.id);
      setDeletingTicker(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker symbol"
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors p-2.5"
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
        <button
          type="submit"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tickers.map((ticker) => (
          <div
            key={ticker.id}
            className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5"
          >
            <span className="text-sm font-medium text-gray-900">{ticker.ticker}</span>
            <button
              onClick={() => handleDeleteClick(ticker)}
              className="ml-2 text-gray-500 hover:text-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
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