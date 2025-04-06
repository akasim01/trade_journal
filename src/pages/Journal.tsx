import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Trade, UserSettings, DEFAULT_SETTINGS, UserStrategy } from '../types';
import { Plus, Download, Pencil, Trash2, ChevronLeft, Image, FileText, CheckSquare, Square } from 'lucide-react';
import Calendar from '../components/Calendar';
import { formatTradeDuration } from '../utils/duration';
import { Link } from 'react-router-dom';
import { formatLocalTime, formatDateFromDB, localToUTC } from '../utils/date';
import TradeForm from '../components/TradeForm';
import SnapshotViewer from '../components/SnapshotViewer';
import DeleteConfirmation from '../components/DeleteConfirmation';
import NotesModal from '../components/NotesModal';
import StrategyModal from '../components/StrategyModal';
import StrategyBadge from '../components/StrategyBadge';
import { deleteSnapshot } from '../utils/storage';
import { EmbeddingsService } from '../lib/embeddings';

interface JournalProps {
  user: User;
}

export default function Journal({ user }: JournalProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [editingTradeStrategy, setEditingTradeStrategy] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<UserStrategy | null>(null);
  const [embeddingsService] = useState(() => new EmbeddingsService(user.id));

  useEffect(() => {
    fetchSettings();
    fetchStrategies();
    initializeEmbeddings();
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [selectedDate]);

  const initializeEmbeddings = async () => {
    await embeddingsService.initialize();
    await embeddingsService.backfillEmbeddings();
  };

  const fetchSettings = async () => {
    try {
      const { data: existingSettings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchStrategies = async () => {
    try {
      const { data, error } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  const fetchTrades = async () => {
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', formattedDate)
      .order('entry_time', { ascending: true });

    if (error) {
      console.error('Error fetching trades:', error);
      return;
    }

    setTrades(data || []);

    // Ensure embeddings exist for all trades
    if (data && data.length > 0) {
      await embeddingsService.backfillEmbeddings();
    }
  };

  const handleSubmit = async (tradeData: Omit<Trade, 'duration_seconds'>) => {
    const entryTimeUTC = localToUTC(tradeData.entry_time!, settings.timezone);
    const exitTimeUTC = localToUTC(tradeData.exit_time!, settings.timezone);
    const finalTradeData = {
      ...tradeData,
      user_id: user.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      entry_time: entryTimeUTC,
      exit_time: exitTimeUTC,
    };

    let error;
    let newTradeId: string | null = null;
    
    if (editingTradeId) {
      // Get the existing trade
      const existingTrade = trades.find(t => t.id === editingTradeId);
      
      // If the snapshot URL has changed and there was an old one, delete it
      if (existingTrade?.snapshot_url && existingTrade.snapshot_url !== finalTradeData.snapshot_url) {
        try {
          await deleteSnapshot(existingTrade.snapshot_url);
        } catch (error) {
          console.error('Error deleting old snapshot:', error);
        }
      }

      const { id, created_at, duration_seconds, ...updateData } = finalTradeData as any;
      const { data: updatedTrade, error: updateError } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', editingTradeId)
        .eq('user_id', user.id)
        .select()
        .single();
        
      error = updateError;
      if (updatedTrade) {
        newTradeId = updatedTrade.id;
      }
    } else {
      const { duration_seconds, ...insertData } = finalTradeData as any;
      const { data: insertedTrade, error: insertError } = await supabase
        .from('trades')
        .insert([insertData])
        .select()
        .single();
        
      error = insertError;
      if (insertedTrade) {
        newTradeId = insertedTrade.id;
      }
    }

    if (error) {
      console.error('Error saving trade:', error);
      return;
    }

    // Create embedding for the new/updated trade
    if (newTradeId) {
      try {
        const { data: trade } = await supabase
          .from('trades')
          .select('*')
          .eq('id', newTradeId)
          .single();

        if (trade) {
          await embeddingsService.createEmbedding(trade);
        }
      } catch (error) {
        console.error('Error creating trade embedding:', error);
      }
    }

    setShowForm(false);
    setEditingTradeId(null);
    fetchTrades();
  };

  const handleEdit = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setShowForm(true);
  };

  const handleDelete = async (tradeId: string) => {
    const trade = trades.find(t => t.id === tradeId);
    
    await deleteTrades([tradeId], trade?.snapshot_url ? [trade.snapshot_url] : []);
    setDeletingTradeId(null);
    setShowForm(false);
    setEditingTradeId(null);
    fetchTrades();
  };

  const handleBulkDelete = async () => {
    const tradesToDelete = trades.filter(t => selectedTrades.has(t.id));
    const snapshotUrls = tradesToDelete
      .map(t => t.snapshot_url)
      .filter((url): url is string => !!url);

    await deleteTrades(Array.from(selectedTrades), snapshotUrls);
    setSelectedTrades(new Set());
    setSelectionMode(false);
    fetchTrades();
  };

  const deleteTrades = async (tradeIds: string[], snapshotUrls: string[]) => {
    // Delete snapshots if they exist
    for (const url of snapshotUrls) {
      await deleteSnapshot(url).catch(error => 
        console.error('Error deleting snapshot:', error)
      );
    }

    // Delete embedding first
    for (const id of tradeIds) {
      await embeddingsService.deleteEmbedding(id);
    }

    const { error } = await supabase
      .from('trades')
      .delete()
      .in('id', tradeIds)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  };

  const toggleTradeSelection = (tradeId: string) => {
    const newSelected = new Set(selectedTrades);
    if (newSelected.has(tradeId)) {
      newSelected.delete(tradeId);
    } else {
      newSelected.add(tradeId);
    }
    setSelectedTrades(newSelected);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTrades(new Set());
      setAllSelected(false);
    } else {
      setSelectedTrades(new Set(trades.map(t => t.id)));
      setAllSelected(true);
    }
  };

  const handleStrategySelect = async (strategyId?: string) => {
    if (!editingTradeStrategy) return;

    const { error } = await supabase
      .from('trades')
      .update({ strategy_id: strategyId })
      .eq('id', editingTradeStrategy)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating trade strategy:', error);
      return;
    }

    fetchTrades();
    setEditingTradeStrategy(null);
  };

  const handleStrategyClick = (strategy: UserStrategy) => {
    setSelectedStrategy(strategy);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency
    }).format(amount);
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Entry Time',
      'Exit Time',
      'Duration',
      'Ticker',
      'Strategy',
      'Direction',
      'Contracts',
      'P&L',
      'Commission/Contract',
      'Net P&L',
      'Notes'
    ];
    
    const csvData = trades.map(trade => {
      const strategy = strategies.find(s => s.id === trade.strategy_id);
      return [
        formatDateFromDB(trade.date, settings.timezone),
        formatLocalTime(trade.entry_time, settings.timezone),
        formatLocalTime(trade.exit_time, settings.timezone),
        trade.duration_seconds ? formatTradeDuration(trade.duration_seconds) : '',
        trade.ticker,
        strategy?.name || 'No Strategy',
        trade.direction,
        trade.contracts,
        formatCurrency(trade.profit_loss),
        formatCurrency(trade.commission_per_contract),
        formatCurrency(trade.net_profit),
        trade.notes || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trades_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const dailyPnL = trades.reduce((sum, trade) => sum + trade.net_profit, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
            </div>
            <div className="flex items-center justify-between">
              <Calendar
                selectedDate={selectedDate}
                onChange={setSelectedDate}
                className="flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
              />
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedTrades(new Set());
                  }}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectionMode 
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {selectionMode ? <CheckSquare className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />}
                  Select Trades
                </button>
                {selectionMode && selectedTrades.size > 0 && (
                  <button
                    onClick={() => setDeletingTradeId('bulk')}
                    className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Selected ({selectedTrades.size})
                  </button>
                )}
                <div className="flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200">
                  <span className="text-gray-600 mr-2">Daily P&L:</span>
                  <span className={`font-semibold ${dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(dailyPnL)}
                  </span>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Trade
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center justify-center bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-7xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {editingTradeId ? 'Edit Trade' : 'Add New Trade'}
              </h2>
              <TradeForm
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingTradeId(null);
                }}
                initialData={editingTradeId ? trades.find(t => t.id === editingTradeId) : undefined}
                defaultCommission={settings.default_commission}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        )}

        {selectedSnapshot && (
          <SnapshotViewer
            imageUrl={selectedSnapshot}
            onClose={() => setSelectedSnapshot(null)}
          />
        )}

        {(deletingTradeId === 'bulk' ? selectedTrades.size > 0 : deletingTradeId) && (
          <DeleteConfirmation
            onConfirm={() => deletingTradeId === 'bulk' ? handleBulkDelete() : handleDelete(deletingTradeId)}
            onCancel={() => setDeletingTradeId(null)}
            count={deletingTradeId === 'bulk' ? selectedTrades.size : undefined}
          />
        )}

        {selectedNotes && (
          <NotesModal
            notes={selectedNotes}
            onClose={() => setSelectedNotes(null)}
          />
        )}

        {showStrategyModal && (
          <StrategyModal
            strategies={strategies}
            selectedStrategyId={editingTradeStrategy || undefined}
            onSelect={handleStrategySelect}
            onClose={() => {
              setShowStrategyModal(false);
              setEditingTradeStrategy(null);
            }}
          />
        )}

        {selectedStrategy && (
          <StrategyModal
            strategy={selectedStrategy}
            onClose={() => setSelectedStrategy(null)}
          />
        )}

        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectionMode && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[50px]">
                      <button
                        onClick={handleSelectAll}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={allSelected ? "Deselect all" : "Select all"}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">Entry/Exit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Duration</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Ticker</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Direction</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[90px]">Contracts</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">P&L</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Commission</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Net P&L</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">R/R</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Strategy</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Notes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Snapshot</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                    {selectionMode && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => toggleTradeSelection(trade.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {selectedTrades.has(trade.id) ? (
                            <CheckSquare className="h-5 w-5" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {formatDateFromDB(trade.date, settings.timezone)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-green-600">
                          Entry: {formatLocalTime(trade.entry_time, settings.timezone)}
                        </span>
                        <span className="text-red-600">
                          Exit: {formatLocalTime(trade.exit_time, settings.timezone)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {trade.duration_seconds ? formatTradeDuration(trade.duration_seconds) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                      {trade.ticker}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        trade.direction === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {trade.contracts}
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium text-center ${
                      trade.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.profit_loss)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 text-center">
                      -{formatCurrency(trade.commission_per_contract * trade.contracts)}
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium text-center ${
                      trade.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.net_profit)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {trade.entry_price && trade.stop_loss && trade.target_price ? (
                        <span className="font-medium text-blue-600">
                          {(Math.abs(trade.target_price - trade.entry_price) / 
                           Math.abs(trade.entry_price - trade.stop_loss)).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      <StrategyBadge
                        strategy={strategies.find(s => s.id === trade.strategy_id)}
                        onClick={() => {
                          const strategy = strategies.find(s => s.id === trade.strategy_id);
                          if (strategy) {
                            handleStrategyClick(strategy);
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {trade.notes ? (
                        <button
                          onClick={() => setSelectedNotes(trade.notes)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View notes"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {trade.snapshot_url ? (
                        <button
                          onClick={() => setSelectedSnapshot(trade.snapshot_url!)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View snapshot"
                        >
                          <Image className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(trade)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Edit trade"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setDeletingTradeId(trade.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Delete trade"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-500 bg-gray-50">
                      No trades recorded for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}