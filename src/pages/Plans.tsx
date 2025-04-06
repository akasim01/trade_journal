import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Plus, LineChart, Pencil, Trash2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TradingPlan, TradePlan, AIMessage } from '../types';
import Calendar from '../components/Calendar';
import TradingPlanForm from '../components/TradingPlanForm';
import TradePlanForm from '../components/TradePlanForm';
import DeleteConfirmation from '../components/DeleteConfirmation';
import { EmbeddingsService } from '../lib/embeddings';

interface PlansProps {
  user: User;
}

function Plans({ user }: PlansProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [plan, setPlan] = useState<TradingPlan | null>(null);
  const [tradePlans, setTradePlans] = useState<TradePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTradingPlanForm, setShowTradingPlanForm] = useState(false);
  const [showTradePlanForm, setShowTradePlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TradingPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<TradingPlan | null>(null);
  const [deletingTradePlan, setDeletingTradePlan] = useState<TradePlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [embeddingsService] = useState(() => new EmbeddingsService(user.id));

  const [editingTradePlan, setEditingTradePlan] = useState<TradePlan | null>(null);

  useEffect(() => {
    fetchPlan();
    initializeEmbeddings();
  }, [selectedDate]);

  const initializeEmbeddings = async () => {
    await embeddingsService.initialize();
  };

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const date = selectedDate.toISOString().split('T')[0];

      // Fetch trading plan for the selected date
      const { data: planData, error: planError } = await supabase
        .from('trading_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();

      if (planError) throw planError;
      setPlan(planData);

      if (planData) {
        // Fetch trade plans if a trading plan exists
        const { data: tradePlansData, error: tradePlansError } = await supabase
          .from('trade_plans')
          .select('*')
          .eq('trading_plan_id', planData.id)
          .order('created_at', { ascending: true });

        if (tradePlansError) throw tradePlansError;
        setTradePlans(tradePlansData || []);
      } else {
        setTradePlans([]);
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (planData: Partial<TradingPlan>) => {
    try {
      const date = selectedDate.toISOString().split('T')[0];
      setLoading(true);
      
      const { data, error } = await supabase
        .from('trading_plans')
        .insert({
          ...planData,
          user_id: user.id,
          date
        })
        .select()
        .single();

      if (error) throw error;
      
      setPlan(data);
      setShowTradingPlanForm(false);
      
      // Create embedding for the new plan
      if (data) {
        try {
          await embeddingsService.createPlanEmbedding(data, []);
        } catch (embeddingError) {
          console.error('Error creating plan embedding:', embeddingError);
          // Continue even if embedding fails - it's not critical
        }
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('Failed to create plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (planData: Partial<TradingPlan>) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('trading_plans')
        .update(planData)
        .eq('id', editingPlan!.id)
        .select()
        .single();

      if (error) throw error;
      
      setPlan(data);
      setEditingPlan(null);
      setShowTradingPlanForm(false);
      
      // Update embedding for the edited plan
      if (data) {
        try {
          const { data: tradePlans } = await supabase
            .from('trade_plans')
            .select('*')
            .eq('trading_plan_id', data.id)
            .order('created_at', { ascending: true });
            
          await embeddingsService.createPlanEmbedding(data, tradePlans || []);
        } catch (embeddingError) {
          console.error('Error updating plan embedding:', embeddingError);
          // Continue even if embedding fails - it's not critical
        }
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    try {
      setIsDeleting(true);
      
      // Delete plan embedding first
      await embeddingsService.deletePlanEmbedding(deletingPlan!.id);
      
      const { error } = await supabase
        .from('trading_plans')
        .delete()
        .eq('id', deletingPlan!.id);

      if (error) {
        console.error('Error deleting plan:', error);
        throw new Error('Failed to delete plan');
      }
      
      setPlan(null);
      setTradePlans([]);
      setDeletingPlan(null);
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTradePlan = async () => {
    try {
      const { error } = await supabase
        .from('trade_plans')
        .delete()
        .eq('id', deletingTradePlan!.id);

      if (error) throw error;
      
      setTradePlans(tradePlans.filter(tp => tp.id !== deletingTradePlan!.id));
      setDeletingTradePlan(null);
    } catch (error) {
      console.error('Error deleting trade plan:', error);
    }
  };

  const handleCreateTradePlan = async (tradePlanData: Partial<TradePlan>) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('trade_plans')
        .insert(tradePlanData)
        .select()
        .single();

      if (error) {
        console.error('Error creating trade plan:', error);
        alert('Failed to create trade plan. Please try again.');
        return;
      }
      
      setTradePlans([...tradePlans, data]);
      
      // Update embedding with new trade plan
      if (plan) {
        try {
          await embeddingsService.createPlanEmbedding(plan, [...tradePlans, data]);
        } catch (embeddingError) {
          console.error('Error updating plan embedding:', embeddingError);
          // Continue even if embedding fails - it's not critical
        }
      }
      
      setShowTradePlanForm(false);
    } catch (error) {
      console.error('Error creating trade plan:', error);
      alert('Failed to create trade plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTradePlan = async (tradePlanData: Partial<TradePlan>) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('trade_plans')
        .update(tradePlanData)
        .eq('id', editingTradePlan!.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating trade plan:', error);
        alert('Failed to save trade plan. Please try again.');
        return;
      }
      
      setTradePlans(tradePlans.map(tp => tp.id === data.id ? data : tp));
      
      // Update embedding with updated trade plan
      if (plan) {
        const updatedTradePlans = tradePlans.map(tp => tp.id === data.id ? data : tp);
        try {
          await embeddingsService.createPlanEmbedding(plan, updatedTradePlans);
        } catch (embeddingError) {
          console.error('Error updating plan embedding:', embeddingError);
          // Continue even if embedding fails - it's not critical
        }
      }
      
      setEditingTradePlan(null);
      setShowTradePlanForm(false);
    } catch (error) {
      console.error('Error updating trade plan:', error);
      alert('Failed to save trade plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Trading Plans</h1>
            </div>
            <div className="flex items-center justify-between">
              <Calendar
                selectedDate={selectedDate}
                onChange={setSelectedDate}
                className="flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
              />
              <div className="flex items-center space-x-4">
                {/* <Link
                  to="/reports"
                  className="flex items-center h-9 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  View All plans
                </Link> */}
                
              {plan && (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowTradePlanForm(true)}
                    className="flex items-center h-9 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Trade Setup
                  </button>
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setShowTradingPlanForm(true);
                    }}
                    className="flex items-center h-9 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Edit Daily Plan
                  </button>
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    className="flex items-center h-9 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Daily Plan
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {plan ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Daily Plan Overview */}
            <div className="lg:col-span-2 space-y-3">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Plan</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Market Bias</h3>
                    <p className="mt-1 text-sm text-gray-900">{plan.market_bias || 'No bias set'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Key Levels</h3>
                    {plan.key_levels && plan.key_levels.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {plan.key_levels.map((level, index) => (
                          <li key={index} className="text-sm text-gray-900">{level}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">No key levels defined</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Economic Events</h3>
                    {plan.economic_events && plan.economic_events.length > 0 ? (
                      <ul className="mt-1 space-y-2">
                        {plan.economic_events.map((event, index) => (
                          <li key={index} className="text-sm">
                            <span className="text-gray-900">{event.time}</span>
                            <span className="mx-2">-</span>
                            <span className="text-gray-900">{event.event}</span>
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                              event.impact === 'high' ? 'bg-red-100 text-red-800' :
                              event.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {event.impact} impact
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">No economic events today</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700">News Impact</h3>
                    <p className="mt-1 text-sm text-gray-900">{plan.news_impact || 'No news impact noted'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Max Daily Loss</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {plan.max_daily_loss ? `$${plan.max_daily_loss.toFixed(2)}` : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trade Plans */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Trade Setups</h2>
                  {tradePlans.length > 0 ? (
                    <div className="space-y-3">
                      {tradePlans.map((tradePlan) => (
                        <div
                          key={tradePlan.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{tradePlan.ticker}</span>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  tradePlan.direction === 'long' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {tradePlan.direction.toUpperCase()}
                                </span>
                                {tradePlan.timeframe && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                    {tradePlan.timeframe}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDeletingTradePlan(tradePlan)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete trade setup"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTradePlan(tradePlan);
                                  setShowTradePlanForm(true);
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit trade setup"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Price Levels and Risk/Reward */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4">
                              <p className="text-sm bg-gray-50 p-2 rounded-lg">
                                <span className="text-gray-500">Entry:</span>{' '}
                                <span className="font-medium text-gray-900">${tradePlan.entry_price.toFixed(2)}</span>
                              </p>
                              <p className="text-sm bg-gray-50 p-2 rounded-lg">
                                <span className="text-gray-500">Stop:</span>{' '}
                                <span className="font-medium text-red-600">${tradePlan.stop_loss.toFixed(2)}</span>
                              </p>
                              <p className="text-sm bg-gray-50 p-2 rounded-lg">
                                <span className="text-gray-500">Target:</span>{' '}
                                <span className="font-medium text-green-600">${tradePlan.target_price.toFixed(2)}</span>
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <p className="text-sm bg-red-50 p-2 rounded-lg">
                                <span className="text-gray-500 text-xs block">Risk</span>
                                <span className="text-lg font-bold text-red-600 block">${tradePlan.risk_amount.toFixed(2)}</span>
                              </p>
                              <p className="text-sm bg-green-50 p-2 rounded-lg">
                                <span className="text-gray-500 text-xs block">Reward</span>
                                <span className="text-lg font-bold text-green-600 block">${tradePlan.reward_amount.toFixed(2)}</span>
                              </p>
                              <p className="text-sm bg-blue-50 p-2 rounded-lg">
                                <span className="text-gray-500 text-xs block">R/R</span>
                                <span className="text-lg font-bold text-blue-600 block">
                                  {(tradePlan.reward_amount / tradePlan.risk_amount).toFixed(2)}
                                </span>
                              </p>
                            </div>
                            <p className="text-sm bg-gray-50 p-2 rounded-lg">
                              <span className="text-gray-500">Max Position Size:</span>{' '}
                              <span className="font-medium text-gray-900">{tradePlan.max_position_size} contracts</span>
                            </p>
                          </div>

                          {(tradePlan.entry_criteria || tradePlan.exit_criteria) && (
                            <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                              {tradePlan.entry_criteria && (
                                <div>
                                  <p className="text-sm">
                                    <span className="text-gray-500">Entry Criteria:</span>{' '}
                                    <span className="text-gray-900">{tradePlan.entry_criteria}</span>
                                  </p>
                                </div>
                              )}
                              {tradePlan.exit_criteria && (
                                <div>
                                  <p className="text-sm">
                                    <span className="text-gray-500">Exit Criteria:</span>{' '}
                                    <span className="text-gray-900">{tradePlan.exit_criteria}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No trade setups created yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats and Analysis */}
            <div className="space-y-3">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Risk Analysis</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Total Risk</h3>
                    <p className="text-2xl font-bold text-red-600">
                      ${tradePlans.reduce((sum, plan) => sum + plan.risk_amount, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Potential Reward</h3>
                    <p className="text-2xl font-bold text-green-600">
                      ${tradePlans.reduce((sum, plan) => sum + plan.reward_amount, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Average R/R Ratio</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {tradePlans.length > 0
                        ? `${(tradePlans.reduce((sum, plan) => sum + (plan.reward_amount / plan.risk_amount), 0) / tradePlans.length).toFixed(2)}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Daily Plan</h3>
            <p className="text-sm text-gray-500 mb-6">
              Create a daily plan to document your strategy and trade setups for the day.
            </p>
            <button
              onClick={() => setShowTradingPlanForm(true)} 
              className="inline-flex items-center h-9 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Daily Plan
            </button>
          </div>
        )}
      </main>

      {/* Trading Plan Form Modal */}
      {showTradingPlanForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPlan ? 'Edit Daily Plan' : 'Create Daily Plan'}
            </h2>
            <TradingPlanForm
              onSubmit={editingPlan ? handleEditPlan : handleCreatePlan}
              initialData={editingPlan}
              onCancel={() => setShowTradingPlanForm(false)}
            />
          </div>
        </div>
      )}

      {/* Trade Plan Form Modal */}
      {showTradePlanForm && plan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingTradePlan ? 'Edit Trade Setup' : 'Add Trade Setup'}
            </h2>
            <TradePlanForm
              tradingPlanId={plan.id}
              onSubmit={editingTradePlan ? handleEditTradePlan : handleCreateTradePlan}
              initialData={editingTradePlan}
              onCancel={() => setShowTradePlanForm(false)}
            />
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation */}
      {deletingPlan && (
        <DeleteConfirmation
          title="Delete Daily Plan"
          message="Are you sure you want to delete this daily plan? This will also delete all associated trade setups."
          onConfirm={handleDeletePlan}
          onCancel={() => setDeletingPlan(null)}
          loading={isDeleting}
        />
      )}

      {/* Delete Trade Plan Confirmation */}
      {deletingTradePlan && (
        <DeleteConfirmation
          title="Delete Trade Setup"
          message="Are you sure you want to delete this trade setup?"
          onConfirm={handleDeleteTradePlan}
          onCancel={() => setDeletingTradePlan(null)}
        />
      )}
    </div>
  );
}

export default Plans