import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { BrokerConfig } from '../types';
import { supabase } from '../lib/supabase';

interface BrokerFieldMappingProps {
  broker: BrokerConfig;
  csvHeaders: string[];
  onSave: () => void;
  onCancel: () => void;
}

const TRADOVATE_MAPPINGS = {
  ticker: 'symbol',
  contracts: 'qty',
  profit_loss: 'pnl',
  buy_time: 'boughtTimestamp',
  sell_time: 'soldTimestamp'
};

export default function BrokerFieldMapping({ broker, csvHeaders, onSave, onCancel }: BrokerFieldMappingProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(broker.field_mappings || {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Auto-map fields for Tradovate
    if (broker.broker_name.toLowerCase() === 'tradovate') {
      const newMappings: Record<string, string> = {};
      for (const [field, csvField] of Object.entries(TRADOVATE_MAPPINGS)) {
        if (csvHeaders.includes(csvField)) {
          newMappings[field] = csvField;
        }
      }
      setMappings(newMappings);
    }
  }, [broker.broker_name, csvHeaders]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save mappings
      const { error: updateError } = await supabase
        .from('broker_import_configs')
        .update({
          field_mappings: mappings
        })
        .eq('id', broker.id);

      if (updateError) throw updateError;
      onSave();
    } catch (error) {
      console.error('Error saving field mappings:', error);
      setError('Failed to save field mappings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Field Mappings for {broker.broker_name}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
            <p className="text-sm text-blue-700">
              Fields have been automatically mapped for {broker.broker_name}. The following transformations will be applied:
            </p>
            <ul className="mt-2 text-sm text-blue-600 list-disc list-inside">
              <li>Ticker symbols will be truncated to first 3 letters</li>
              <li>Trade direction will be determined from timestamps</li>
              <li>Commission will be added from your settings</li>
              <li>Dates and times will be properly formatted</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(mappings).map(([field, csvField]) => (
              <div key={field} className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="text-sm text-blue-600">
                  ← {csvField}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleSave}
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
                <Save className="h-4 w-4 mr-1.5" />
                Save Mappings
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}