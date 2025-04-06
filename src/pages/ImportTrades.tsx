import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Upload, FileText, AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrokerConfig, CSVPreviewData, MappedTrade, UserSettings, DEFAULT_SETTINGS } from '../types';
import Papa from 'papaparse';
import { format, parse, parseISO } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

interface ImportTradesProps {
  user: User;
}

function ImportTrades({ user }: ImportTradesProps) {
  const [brokerConfigs, setBrokerConfigs] = useState<BrokerConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrokerConfig | null>(null);
  const [csvData, setCSVData] = useState<CSVPreviewData | null>(null);
  const [mappedTrades, setMappedTrades] = useState<MappedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetchBrokerConfigs();
    fetchSettings();
  }, []);

  const fetchBrokerConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_import_configs')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setBrokerConfigs(data || []);
    } catch (error) {
      console.error('Error fetching broker configs:', error);
      setError('Failed to load broker configurations');
    } finally {
      setLoading(false);
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
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        if (results.data.length > 0) {
          const headers = results.data[0] as string[];
          const rows = results.data.slice(1) as string[][];
          
          // Filter out empty rows
          const validRows = rows.filter(row => row.some(cell => cell.trim() !== ''));
          
          setCSVData({
            headers,
            rows: validRows
          });
          setError(null);
          validateAndMapTrades(headers, validRows);
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setError('Failed to parse CSV file');
      }
    });
  };

  const parseDate = (dateStr: string, timezone: string): Date | null => {
    try {
      // Try different date formats
      const formats = [
        'MM/dd/yyyy HH:mm:ss',
        'MM/dd/yyyy HH:mm',
        'yyyy-MM-dd HH:mm:ss',
        'yyyy-MM-dd HH:mm'
      ];

      for (const fmt of formats) {
        const date = parse(dateStr, fmt, new Date());
        if (date.toString() !== 'Invalid Date') {
          // Convert the parsed local date to UTC considering the user's timezone
          return zonedTimeToUtc(date, timezone);
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const validateAndMapTrades = (headers: string[], rows: string[][]) => {
    if (!selectedConfig) return;

    const mappings = selectedConfig.field_mappings;
    const trades: MappedTrade[] = rows.map((row) => {
      const errors: string[] = [];
      const mappedTrade: Partial<MappedTrade> = {
        valid: true,
        errors: []
      };

      // Helper function to get value by field name
      const getValue = (fieldName: string): string => {
        const csvField = mappings[fieldName];
        if (!csvField) return '';
        const index = headers.indexOf(csvField);
        return index >= 0 ? (row[index] || '').trim() : '';
      };

      // Parse ticker (extract first 3 letters)
      const ticker = getValue('ticker');
      if (ticker) {
        mappedTrade.ticker = ticker.substring(0, 3);
      } else {
        errors.push('Missing ticker');
      }

      // Parse quantity/contracts
      const qtyStr = getValue('contracts');
      if (qtyStr) {
        const qty = parseInt(qtyStr);
        if (!isNaN(qty) && qty > 0) {
          mappedTrade.contracts = qty;
        } else {
          errors.push('Invalid quantity');
        }
      } else {
        errors.push('Missing quantity');
      }

      // Parse timestamps and determine direction
      const buyTime = getValue('buy_time');
      const sellTime = getValue('sell_time');
      const buyDate = buyTime ? parseDate(buyTime, settings.timezone) : null;
      const sellDate = sellTime ? parseDate(sellTime, settings.timezone) : null;

      if (buyDate && sellDate) {
        // Determine direction based on timestamps
        const isLong = buyDate < sellDate;
        mappedTrade.direction = isLong ? 'long' : 'short';
        
        // Set entry/exit times based on direction
        if (isLong) {
          mappedTrade.entry_time = buyDate.toISOString();
          mappedTrade.exit_time = sellDate.toISOString();
        } else {
          mappedTrade.entry_time = sellDate.toISOString();
          mappedTrade.exit_time = buyDate.toISOString();
        }

        // Set date from entry time (using the entry time in user's timezone)
        mappedTrade.date = format(isLong ? buyDate : sellDate, 'yyyy-MM-dd');
      } else {
        errors.push('Invalid timestamps');
      }

      // Parse P&L
      const pnlStr = getValue('profit_loss');
      if (pnlStr) {
        // Remove $ and parentheses, handle negative values
        const cleanPnl = pnlStr.replace(/[$(),]/g, '');
        const isNegative = pnlStr.includes('(') || pnlStr.includes('-');
        const pnl = parseFloat(cleanPnl) * (isNegative ? -1 : 1);
        
        if (!isNaN(pnl)) {
          mappedTrade.profit_loss = pnl;
        } else {
          errors.push('Invalid P&L amount');
        }
      } else {
        errors.push('Missing P&L');
      }

      // Set commission from user settings
      mappedTrade.commission_per_contract = settings.default_commission;

      // Calculate net profit
      if (mappedTrade.profit_loss !== undefined && mappedTrade.contracts !== undefined) {
        mappedTrade.net_profit = mappedTrade.profit_loss - 
          (mappedTrade.contracts * mappedTrade.commission_per_contract);
      }

      return {
        ...mappedTrade,
        valid: errors.length === 0,
        errors
      } as MappedTrade;
    });

    setMappedTrades(trades);
  };

  const handleImport = async () => {
    try {
      setError(null);
      const validTrades = mappedTrades.filter(t => t.valid);
      
      if (validTrades.length === 0) {
        setError('No valid trades to import');
        return;
      }

      const tradesToInsert = validTrades.map(({ valid, errors, ...trade }) => ({
        ...trade,
        user_id: user.id
      }));

      const { error: insertError } = await supabase
        .from('trades')
        .insert(tradesToInsert);

      if (insertError) throw insertError;

      setSuccess(`Successfully imported ${validTrades.length} trades`);
      setCSVData(null);
      setMappedTrades([]);
    } catch (error) {
      console.error('Error importing trades:', error);
      setError('Failed to import trades');
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
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Import Trades</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Broker Selection */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select Broker</h2>
            {brokerConfigs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No broker configurations found</p>
                <Link
                  to="/settings"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Settings className="h-4 w-4 mr-1.5" />
                  Configure Brokers
                </Link>
              </div>
            ) : (
              <select
                value={selectedConfig?.id || ''}
                onChange={(e) => {
                  const config = brokerConfigs.find(c => c.id === e.target.value);
                  setSelectedConfig(config || null);
                  setCSVData(null);
                  setMappedTrades([]);
                }}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select a broker...</option>
                {brokerConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.broker_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* File Upload Section */}
          {selectedConfig && (
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-12 w-12 text-gray-400 mb-3" />
                  <span className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-gray-500">CSV files only</span>
                </label>
              </div>
            </div>
          )}

          {/* Preview and Import Section */}
          {mappedTrades.length > 0 && (
            <div className="lg:col-span-2 bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Preview and Import</h2>
              
              {/* Validation Summary */}
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
                    <span>Valid: {mappedTrades.filter(t => t.valid).length}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
                    <span>Invalid: {mappedTrades.filter(t => !t.valid).length}</span>
                  </div>
                </div>
              </div>

              {/* Trades Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contracts</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P&L</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mappedTrades.map((trade, index) => (
                      <tr key={index} className={trade.valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {trade.valid ? (
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {trade.date}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {trade.ticker}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {trade.direction}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {trade.contracts}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {trade.profit_loss}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-red-500">
                          {trade.errors?.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleImport}
                  disabled={mappedTrades.some(t => !t.valid)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import Trades
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="lg:col-span-2 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="lg:col-span-2 bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ImportTrades;