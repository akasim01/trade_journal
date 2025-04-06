import React from 'react';
import { format } from 'date-fns';
import { TradingPlan, TradePlan } from '../types';
import { ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

interface TradingPlansReportProps {
  plans: TradingPlan[];
  tradePlans: Record<string, TradePlan[]>;
  selectionMode: boolean;
  selectedPlans: Set<string>;
  onToggleSelection: (planId: string) => void;
  expandedPlans: Set<string>;
  onTogglePlan: (planId: string) => void;
  currency: string;
}

export default function TradingPlansReport({
  plans,
  tradePlans,
  selectionMode,
  selectedPlans,
  onToggleSelection,
  expandedPlans,
  onTogglePlan,
  currency
}: TradingPlansReportProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectionMode && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[50px]">
                  <button
                    onClick={() => {
                      const allSelected = plans.every(p => selectedPlans.has(p.id));
                      if (allSelected) {
                        selectedPlans.clear();
                      } else {
                        plans.forEach(p => selectedPlans.add(p.id));
                      }
                    }}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {selectedPlans.size === plans.length ? (
                      <CheckSquare className="h-5 w-5" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[50px]"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Bias</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key Levels</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Daily Loss</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trade Setups</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {plans.map((plan) => (
              <React.Fragment key={plan.id}>
                <tr className={`hover:bg-gray-50 transition-colors ${selectedPlans.has(plan.id) ? 'bg-blue-50' : ''}`}>
                  {selectionMode && (
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => onToggleSelection(plan.id)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {selectedPlans.has(plan.id) ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onTogglePlan(plan.id)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      {expandedPlans.has(plan.id) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(plan.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.market_bias || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {plan.key_levels?.length ? (
                      <ul className="list-disc list-inside">
                        {plan.key_levels.map((level, index) => (
                          <li key={index}>{level}</li>
                        ))}
                      </ul>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.max_daily_loss ? formatCurrency(plan.max_daily_loss) : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(tradePlans[plan.id]?.length || 0)} setups
                  </td>
                </tr>
                {expandedPlans.has(plan.id) && tradePlans[plan.id]?.length > 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 bg-gray-50">
                      <div className="space-y-4">
                        {tradePlans[plan.id].map((tradePlan) => (
                          <div
                            key={tradePlan.id}
                            className="bg-white rounded-lg border border-gray-200 p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">
                                  {tradePlan.ticker} - {tradePlan.direction.toUpperCase()}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {tradePlan.timeframe || 'No timeframe specified'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  R/R: {(tradePlan.reward_amount / tradePlan.risk_amount).toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Max Size: {tradePlan.max_position_size} contracts
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Entry</p>
                                <p className="font-medium text-gray-900">
                                  ${tradePlan.entry_price}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Stop Loss</p>
                                <p className="font-medium text-red-600">
                                  ${tradePlan.stop_loss}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Target</p>
                                <p className="font-medium text-green-600">
                                  ${tradePlan.target_price}
                                </p>
                              </div>
                            </div>

                            {(tradePlan.entry_criteria || tradePlan.exit_criteria) && (
                              <div className="mt-4 space-y-2 text-sm">
                                {tradePlan.entry_criteria && (
                                  <div>
                                    <p className="text-gray-500">Entry Criteria</p>
                                    <p className="text-gray-900">{tradePlan.entry_criteria}</p>
                                  </div>
                                )}
                                {tradePlan.exit_criteria && (
                                  <div>
                                    <p className="text-gray-500">Exit Criteria</p>
                                    <p className="text-gray-900">{tradePlan.exit_criteria}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 bg-gray-50">
                  No trading plans found for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}