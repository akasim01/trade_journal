import React from 'react';
import { PatternRecommendation } from '../types';
import { formatCurrency } from '../utils/format';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface PatternRecommendationsProps {
  recommendations: PatternRecommendation[];
  currency: string;
  onStatusChange?: (id: string, status: PatternRecommendation['status']) => void;
}

export default function PatternRecommendations({
  recommendations,
  currency,
  onStatusChange
}: PatternRecommendationsProps) {
  const getStatusColor = (status: PatternRecommendation['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'triggered':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'invalidated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: PatternRecommendation['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'triggered':
        return <CheckCircle className="h-4 w-4" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4" />;
      case 'invalidated':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isExpired = (expiration: string) => {
    return new Date(expiration) < new Date();
  };

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className={`border rounded-lg p-4 ${
            rec.status === 'pending' ? 'border-blue-200 bg-blue-50' :
            rec.status === 'triggered' ? 'border-green-200 bg-green-50' :
            rec.status === 'expired' ? 'border-gray-200 bg-gray-50' :
            'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">{rec.ticker}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                rec.direction === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {rec.direction.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${getStatusColor(rec.status)}`}>
                {getStatusIcon(rec.status)}
                {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
              </span>
              <span className="text-xs text-gray-500">
                {isExpired(rec.expiration) ? 'Expired' : `Expires in ${
                  Math.ceil((new Date(rec.expiration).getTime() - Date.now()) / (1000 * 60 * 60)
                )}h`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-sm text-gray-500">Entry Zone</p>
              <p className="font-medium">
                {formatCurrency(rec.entry_zone.lower, currency)} - {formatCurrency(rec.entry_zone.upper, currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Stop Loss</p>
              <p className="font-medium text-red-600">
                {formatCurrency(rec.stop_loss, currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Target</p>
              <p className="font-medium text-green-600">
                {formatCurrency(rec.target_price, currency)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${rec.confidence_score * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">
                {(rec.confidence_score * 100).toFixed(0)}% confidence
              </span>
            </div>

            {rec.status === 'pending' && !isExpired(rec.expiration) && onStatusChange && (
              <div className="flex gap-2">
                <button
                  onClick={() => onStatusChange(rec.id, 'triggered')}
                  className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                >
                  Mark Triggered
                </button>
                <button
                  onClick={() => onStatusChange(rec.id, 'invalidated')}
                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Invalidate
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {recommendations.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No active recommendations</p>
        </div>
      )}
    </div>
  );
}