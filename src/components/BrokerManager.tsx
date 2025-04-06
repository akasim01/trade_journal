import React, { useState } from 'react';
import { BrokerConfig } from '../types';
import { Plus, X, Settings } from 'lucide-react';
import BrokerFieldMapping from './BrokerFieldMapping';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface BrokerManagerProps {
  brokers: BrokerConfig[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (brokerId: string) => Promise<void>;
}

export default function BrokerManager({ brokers, onAdd, onDelete }: BrokerManagerProps) {
  const [newBrokerName, setNewBrokerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerConfig | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [deletingBroker, setDeletingBroker] = useState<BrokerConfig | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = newBrokerName.trim();

    if (!name) {
      setError('Please enter a broker name');
      return;
    }

    if (brokers.some(b => b.broker_name.toLowerCase() === name.toLowerCase())) {
      setError('This broker already exists');
      return;
    }

    try {
      await onAdd(name);
      setNewBrokerName('');
    } catch (error) {
      setError('Failed to add broker');
    }
  };

  const handleFileUpload = (broker: BrokerConfig) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const headers = text.split('\n')[0].split(',').map(h => h.trim());
          setCSVHeaders(headers);
          setSelectedBroker(broker);
          setShowMapping(true);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDeleteClick = (broker: BrokerConfig) => {
    setDeletingBroker(broker);
  };

  const handleDeleteConfirm = async () => {
    if (deletingBroker) {
      await onDelete(deletingBroker.id);
      setDeletingBroker(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={newBrokerName}
            onChange={(e) => setNewBrokerName(e.target.value)}
            placeholder="Enter broker name"
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

      <div className="space-y-2">
        {brokers.map((broker) => (
          <div
            key={broker.id}
            className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2"
          >
            <span className="text-sm font-medium text-gray-900">{broker.broker_name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFileUpload(broker)}
                className="text-gray-500 hover:text-blue-600 transition-colors"
                title="Configure field mapping"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(broker)}
                className="text-gray-500 hover:text-red-600 transition-colors"
                title="Delete broker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showMapping && selectedBroker && (
        <BrokerFieldMapping
          broker={selectedBroker}
          csvHeaders={csvHeaders}
          onSave={() => {
            setShowMapping(false);
            setSelectedBroker(null);
          }}
          onCancel={() => {
            setShowMapping(false);
            setSelectedBroker(null);
          }}
        />
      )}

      {deletingBroker && (
        <DeleteConfirmationDialog
          title="Delete Broker"
          message={`Are you sure you want to delete the broker "${deletingBroker.broker_name}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingBroker(null)}
        />
      )}
    </div>
  );
}