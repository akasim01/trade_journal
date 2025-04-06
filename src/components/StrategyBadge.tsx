import React from 'react';
import { UserStrategy } from '../types';
import { Lightbulb } from 'lucide-react';

interface StrategyBadgeProps {
  strategy?: UserStrategy;
  onClick?: () => void;
}

export default function StrategyBadge({ strategy, onClick }: StrategyBadgeProps) {
  if (!strategy) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <button
      onClick={onClick}
      title={strategy.name}
      className="inline-flex items-center justify-center w-6 h-6 text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
    >
      <Lightbulb className="h-4 w-4" />
    </button>
  );
}