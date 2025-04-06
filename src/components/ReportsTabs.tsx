import React from 'react';
import { FileText, LineChart } from 'lucide-react';

interface ReportsTabsProps {
  activeTab: 'trades' | 'plans';
  onTabChange: (tab: 'trades' | 'plans') => void;
}

export default function ReportsTabs({ activeTab, onTabChange }: ReportsTabsProps) {
  return (
    <div className="flex space-x-4 border-b border-gray-200">
      <button
        onClick={() => onTabChange('trades')}
        className={`flex items-center px-4 py-2 text-sm font-medium transition-colors relative ${
          activeTab === 'trades'
            ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <FileText className="h-4 w-4 mr-1.5" />
        Trades
      </button>
      <button
        onClick={() => onTabChange('plans')}
        className={`flex items-center px-4 py-2 text-sm font-medium transition-colors relative ${
          activeTab === 'plans'
            ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <LineChart className="h-4 w-4 mr-1.5" />
        Trading Plans
      </button>
    </div>
  );
}