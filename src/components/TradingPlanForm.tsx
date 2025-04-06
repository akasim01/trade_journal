import React, { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { TradingPlan } from '../types';

interface TradingPlanFormProps {
  onSubmit: (plan: Partial<TradingPlan>) => Promise<void>;
  onCancel: () => void;
  initialData?: TradingPlan;
}

export default function TradingPlanForm({ onSubmit, onCancel, initialData }: TradingPlanFormProps) {
  const [formData, setFormData] = useState({
    market_bias: initialData?.market_bias || '',
    key_levels: initialData?.key_levels?.join('\n') || '',
    economic_events: initialData?.economic_events || [],
    news_impact: initialData?.news_impact || '',
    max_daily_loss: initialData?.max_daily_loss?.toString() || ''
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState(initialData?.economic_events || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const planData: Partial<TradingPlan> = {
        ...initialData,
        market_bias: formData.market_bias || null,
        key_levels: formData.key_levels.split('\n').filter(level => level.trim()),
        economic_events: events,
        news_impact: formData.news_impact || null,
        max_daily_loss: formData.max_daily_loss ? parseFloat(formData.max_daily_loss) : null
      };

      await onSubmit(planData);
    } catch (error) {
      console.error('Error saving plan:', error);
      setError('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = () => {
    setEvents([...events, { time: '', event: '', impact: 'low' }]);
  };

  const handleRemoveEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
  };

  const handleEventChange = (index: number, field: string, value: string) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    setEvents(newEvents);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Market Bias */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Bias
          </label>
          <textarea
            value={formData.market_bias}
            onChange={(e) => setFormData({ ...formData, market_bias: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            rows={2}
            placeholder="Enter your market bias for the day..."
          />
        </div>

        {/* Key Levels */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Key Levels
          </label>
          <textarea
            value={formData.key_levels}
            onChange={(e) => setFormData({ ...formData, key_levels: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            rows={4}
            placeholder="Enter key price levels (one per line)..."
          />
        </div>

        {/* Economic Events */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Economic Events
            </label>
            <button
              type="button"
              onClick={handleAddEvent}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Add Event
            </button>
          </div>
          <div className="space-y-3">
            {events.map((event, index) => (
              <div key={index} className="flex items-start gap-3">
                <input
                  type="time"
                  value={event.time}
                  onChange={(e) => handleEventChange(index, 'time', e.target.value)}
                  className="w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                />
                <input
                  type="text"
                  value={event.event}
                  onChange={(e) => handleEventChange(index, 'event', e.target.value)}
                  placeholder="Event description"
                  className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                />
                <select
                  value={event.impact}
                  onChange={(e) => handleEventChange(index, 'impact', e.target.value)}
                  className="w-28 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveEvent(index)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* News Impact */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            News Impact
          </label>
          <textarea
            value={formData.news_impact}
            onChange={(e) => setFormData({ ...formData, news_impact: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
            rows={2}
            placeholder="Enter any relevant news impact..."
          />
        </div>

        {/* Max Daily Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Daily Loss
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.max_daily_loss}
              onChange={(e) => setFormData({ ...formData, max_daily_loss: e.target.value })}
              className="block w-full pl-7 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter max daily loss amount..."
            />
          </div>
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
                  Update Plan
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Plan
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