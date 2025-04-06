import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { UserStrategy } from '../types';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface StrategyManagerProps {
  strategies: UserStrategy[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (strategyId: string) => Promise<void>;
}

export default function StrategyManager({ strategies, onAdd, onDelete }: StrategyManagerProps) {
  const [newStrategy, setNewStrategy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingStrategy, setDeletingStrategy] = useState<UserStrategy | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = newStrategy.trim();

    if (!name) {
      setError('Please enter a strategy name');
      return;
    }

    if (strategies.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setError('This strategy already exists');
      return;
    }

    try {
      await onAdd(name);
      setNewStrategy('');
    } catch (error) {
      setError('Failed to add strategy');
    }
  };

  const handleDeleteClick = (strategy: UserStrategy) => {
    setDeletingStrategy(strategy);
  };

  const handleDeleteConfirm = async () => {
    if (deletingStrategy) {
      await onDelete(deletingStrategy.id);
      setDeletingStrategy(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={newStrategy}
            onChange={(e) => setNewStrategy(e.target.value)}
            placeholder="Enter strategy name"
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
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5"
          >
            <span className="text-sm font-medium text-gray-900">{strategy.name}</span>
            <button
              onClick={() => handleDeleteClick(strategy)}
              className="ml-2 text-gray-500 hover:text-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {deletingStrategy && (
        <DeleteConfirmationDialog
          title="Delete Strategy"
          message={`Are you sure you want to delete the strategy "${deletingStrategy.name}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingStrategy(null)}
        />
      )}
    </div>
  );
}