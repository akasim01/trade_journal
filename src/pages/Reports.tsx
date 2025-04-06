import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Trade, UserSettings, DEFAULT_SETTINGS, DateRangePeriod, UserStrategy } from '../types';
import { ChevronLeft, Download, Square, CheckSquare, Trash2, FileText, Lightbulb, AlertTriangle, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';
import DateRangeSelector from '../components/DateRangeSelector';
import DeleteConfirmation from '../components/DeleteConfirmation';
import NotesModal from '../components/NotesModal';
import StrategyModal from '../components/StrategyModal';
import { formatCurrency } from '../utils/format';
import { formatLocalTime } from '../utils/date';

interface ReportsProps {
  user: User;
}

export default function Reports({ user }: ReportsProps) {
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [period, setPeriod] = useState<DateRangePeriod>('monthly');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [deletingTrades, setDeletingTrades] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [allSelected, setAllSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalTrades, setTotalTrades] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalNetPL, setTotalNetPL] = useState(0);
  const [selectedStrategyDetails, setSelectedStrategyDetails] = useState<UserStrategy | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setCurrentPage(1); // Reset to first page when date range changes
      fetchTotalPL();
      fetchTrades();
    }
  }, [dateRange, settings, pageSize]);

  useEffect(() => {
    if (settings) {
      fetchTrades();
    }
  }, [currentPage]);

  const fetchTotalPL = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('net_profit')
        .eq('user_id', user.id)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'));

      if (error) throw error;
      
      const total = data?.reduce((sum, trade) => sum + trade.net_profit, 0) || 0;
      setTotalNetPL(total);
    } catch (error) {
      console.error('Error fetching total P&L:', error);
    }
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
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    try {
      setError(null);
      
      // First get total count
      const { count, error: countError } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd', { timeZone: settings.timezone }))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd', { timeZone: settings.timezone }));

      if (countError) throw countError;
      setTotalTrades(count || 0);

      // Then fetch paginated data
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      setError('Failed to load trades. Please try again.');
      console.error('Error fetching trades:', error);
    }
  };

  const fetchStrategyDetails = async (strategyId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedStrategyDetails(data);
      }
    } catch (error) {
      console.error('Error fetching strategy:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .in('id', Array.from(selectedTrades))
        .eq('user_id', user.id);

      if (error) throw error;
      setSelectedTrades(new Set());
      fetchTrades();
    } catch (error) {
      console.error('Error deleting items:', error);
    } finally {
      setDeletingTrades(false);
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(trades.map(t => t.id)));
    }
    setAllSelected(!allSelected);
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

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Entry Time',
      'Exit Time',
      'Duration',
      'Ticker',
      'Direction',
      'Contracts',
      'P&L',
      'Commission/Contract',
      'Net P&L',
      'Notes'
    ];
    
    const csvData = trades.map(trade => [
      format(new Date(trade.date), 'MM/dd/yyyy'),
      formatLocalTime(trade.entry_time, settings.timezone),
      formatLocalTime(trade.exit_time, settings.timezone),
      trade.duration_seconds ? `${Math.floor(trade.duration_seconds / 60)} min` : '-',
      trade.ticker,
      trade.direction,
      trade.contracts,
      formatCurrency(trade.profit_loss, settings.currency),
      formatCurrency(trade.commission_per_contract, settings.currency),
      formatCurrency(trade.net_profit, settings.currency),
      trade.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trades_${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Trading Report', 20, 28);

    // Date Range
    doc.setFontSize(14);
    doc.text(`${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`, 20, 50);

    // Summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('Summary', 20, 70);

    doc.setFontSize(12);
    doc.text(`Total P&L: ${formatCurrency(totalNetPL, settings.currency)}`, 20, 85);
    doc.text(`Total Trades: ${trades.length}`, 20, 95);

    // Trade List
    autoTable(doc, {
      startY: 110,
      head: [['Date', 'Time', 'Ticker', 'Dir', 'Qty', 'P&L', 'Net']],
      body: trades.map(trade => [
        format(new Date(trade.date), 'MM/dd/yyyy'),
        `${formatLocalTime(trade.entry_time, settings.timezone)} - ${formatLocalTime(trade.exit_time, settings.timezone)}`,
        trade.ticker,
        trade.direction,
        trade.contracts,
        formatCurrency(trade.profit_loss, settings.currency),
        formatCurrency(trade.net_profit, settings.currency)
      ]),
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [59, 130, 246]
      }
    });

    doc.save(`trading_report_${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}.pdf`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalTrades / pageSize);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchTrades}
                  className="mt-2 flex items-center text-sm text-red-700 hover:text-red-900"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow">
        <div className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            </div>
            <div className="flex items-center justify-between">
              <DateRangeSelector
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                period={period}
                onPeriodChange={setPeriod}
              />
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedTrades(new Set());
                  }}
                  className={`flex items-center h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
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
                    onClick={() => setDeletingTrades(true)}
                    className="flex items-center h-9 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Selected ({selectedTrades.size})
                  </button>
                )}
                <div className="flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200">
                  <span className="text-gray-600 mr-2">Total P&L:</span>
                  <span className={`font-semibold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalNetPL, settings.currency)}
                  </span>
                </div>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center h-9 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export PDF
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center h-9 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalTrades > 0 && (
          <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-lg shadow mb-4">
            <div className="flex items-center">
              <span className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span>
                {' '}-{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalTrades)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{totalTrades}</span>
                {' '}trades
              </span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="ml-4 rounded-md border-gray-300 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
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
                      >
                        {selectedTrades.size === trades.length ? (
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Strategy</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Notes</th>
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
                      {format(parseISO(trade.date), 'MMM d, yyyy')}
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
                      {trade.duration_seconds ? (
                        Math.floor(trade.duration_seconds / 60) + ' min'
                      ) : '-'}
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
                      {formatCurrency(trade.profit_loss, settings.currency)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 text-center">
                      -{formatCurrency(trade.commission_per_contract * trade.contracts, settings.currency)}
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium text-center ${
                      trade.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.net_profit, settings.currency)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {trade.strategy_id ? (
                        <button
                          onClick={() => {
                            setSelectedStrategy(trade.strategy_id);
                            fetchStrategyDetails(trade.strategy_id);
                          }}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View strategy"
                        >
                          <Lightbulb className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500 bg-gray-50">
                      No trades recorded for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      {selectedNotes && (
        <NotesModal
          notes={selectedNotes}
          onClose={() => setSelectedNotes(null)}
        />
      )}

      {deletingTrades && selectedTrades.size > 0 && (
        <DeleteConfirmation
          title="Delete Selected Trades"
          onConfirm={handleBulkDelete}
          onCancel={() => {
            setDeletingTrades(false);
          }}
          count={selectedTrades.size}
        />
      )}

      {selectedStrategy && selectedStrategyDetails && (
        <StrategyModal
          strategy={selectedStrategyDetails}
          onClose={() => {
            setSelectedStrategy(null);
            setSelectedStrategyDetails(null);
          }}
        />
      )}
    </div>
  );
}