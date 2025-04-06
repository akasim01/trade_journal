import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, ChevronLeft, Save, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserSettings, DEFAULT_SETTINGS, UserTicker, UserStrategy, BrokerConfig, TickerPointValue, AIProvider } from '../types';
import TickerManager from '../components/TickerManager';
import StrategyManager from '../components/StrategyManager';
import BrokerManager from '../components/BrokerManager';
import AIConfigManager from '../components/AIConfigManager';
import SettingsSection from '../components/SettingsSection';
import TickerPointValueManager from '../components/TickerPointValueManager';
import AdminPanel from '../components/AdminPanel';
import { X } from 'lucide-react';

interface SettingsProps {
  user: User;
}

function Settings({ user }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [tickers, setTickers] = useState<UserTicker[]>([]);
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [tickerValues, setTickerValues] = useState<TickerPointValue[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchTickers();
    fetchStrategies();
    fetchBrokers();
    fetchTickerValues();
    checkAdminStatus();
  }, []);

//   const checkAdminStatus = async () => {
//   const { data: { session }, error: sessionError } = await supabase.auth.getSession();
//   if (sessionError || !session?.user) {
//     setIsAdmin(false);
//     return;
//   }
//   // Directly use session.user's metadata
//   const isUserAdmin = session.user.app_metadata?.role === 'admin';
//   setIsAdmin(isUserAdmin);
// };

  const checkAdminStatus = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        setIsAdmin(false);
        return;
      }

      // Get user metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        setIsAdmin(false);
        return;
      }
      
      const isUserAdmin = user?.app_metadata?.role === 'admin';
      setIsAdmin(isUserAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchSettings = async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('No authenticated user found');

      // First check if settings exist
      const { data: existingSettings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!existingSettings) {
        // Create default settings for new user
        const defaultSettings = {
          user_id: session.user.id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD',
          default_commission: 0.65
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      } else {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_tickers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTickers(data || []);
    } catch (error) {
      console.error('Error fetching tickers:', error);
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

  const fetchBrokers = async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('No authenticated user found');

      const { data, error } = await supabase
        .from('broker_import_configs')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  };

  const fetchTickerValues = async () => {
    try {
      const { data, error } = await supabase
        .from('ticker_point_values')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTickerValues(data || []);
    } catch (error) {
      console.error('Error fetching ticker values:', error);
    }
  };

  const handleAddTickerValue = async (ticker: string, pointValue: number) => {
    try {
      const { error } = await supabase
        .from('ticker_point_values')
        .insert([{
          user_id: user.id,
          ticker,
          point_value: pointValue
        }]);

      if (error) throw error;
      fetchTickerValues();
    } catch (error) {
      console.error('Error adding ticker value:', error);
      throw error;
    }
  };

  const handleDeleteTickerValue = async (tickerId: string) => {
    try {
      const { error } = await supabase
        .from('ticker_point_values')
        .delete()
        .eq('id', tickerId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchTickerValues();
    } catch (error) {
      console.error('Error deleting ticker value:', error);
    }
  };

  const handleAddTicker = async (ticker: string) => {
    try {
      const { error } = await supabase
        .from('user_tickers')
        .insert([{
          user_id: user.id,
          ticker
        }]);

      if (error) throw error;
      fetchTickers();
    } catch (error) {
      console.error('Error adding ticker:', error);
      throw error;
    }
  };

  const handleDeleteTicker = async (tickerId: string) => {
    try {
      const { error } = await supabase
        .from('user_tickers')
        .delete()
        .eq('id', tickerId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchTickers();
    } catch (error) {
      console.error('Error deleting ticker:', error);
    }
  };

  const handleAddStrategy = async (name: string) => {
    try {
      const { error } = await supabase
        .from('user_strategies')
        .insert([{
          user_id: user.id,
          name
        }]);

      if (error) throw error;
      fetchStrategies();
    } catch (error) {
      console.error('Error adding strategy:', error);
      throw error;
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    try {
      const { error } = await supabase
        .from('user_strategies')
        .delete()
        .eq('id', strategyId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchStrategies();
    } catch (error) {
      console.error('Error deleting strategy:', error);
    }
  };

  const handleAddBroker = async (name: string) => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('No authenticated user found');

      const { data, error } = await supabase
        .from('broker_import_configs')
        .insert([{
          user_id: session.user.id,
          broker_name: name,
          field_mappings: {}
        }])
        .select()
        .single();

      if (error) throw error;
      setBrokers([...brokers, data]);
    } catch (error) {
      console.error('Error adding broker:', error);
      throw error;
    }
  };

  const handleDeleteBroker = async (brokerId: string) => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('No authenticated user found');

      const { error } = await supabase
        .from('broker_import_configs')
        .delete()
        .eq('id', brokerId)
        .eq('user_id', session.user.id);

      if (error) throw error;
      setBrokers(brokers.filter(b => b.id !== brokerId));
    } catch (error) {
      console.error('Error deleting broker:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('No authenticated user found');

      // Ensure user_id is set in settings
      const settingsToSave = {
        ...settings,
        user_id: session.user.id
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert(settingsToSave);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
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
              <SettingsIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {message && (
            <div className={`p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <SettingsSection title="User Settings" defaultOpen={true}>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                >
                  {Intl.supportedValuesOf('timeZone').map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose your timezone to ensure dates and times are displayed correctly
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="CAD">CAD (C$)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Select your preferred currency for displaying profit/loss values
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Commission per Contract
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.default_commission}
                  onChange={(e) => setSettings({ ...settings, default_commission: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Set your default commission rate per contract for new trades
                </p>
              </div>

              <div className="flex justify-end">
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
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </SettingsSection>

          <SettingsSection title="AI Configuration">
            <AIConfigManager userId={user.id} />
          </SettingsSection>

          <SettingsSection title="Broker Configurations">
            <BrokerManager
              brokers={brokers}
              onAdd={handleAddBroker}
              onDelete={handleDeleteBroker}
            />
          </SettingsSection>

          <SettingsSection title="Custom Tickers">
            <TickerManager
              tickers={tickers}
              onAdd={handleAddTicker}
              onDelete={handleDeleteTicker} 
            />
          </SettingsSection>

          <SettingsSection title="Ticker Point Values">
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Configure the dollar value per point for each futures ticker. System tickers cannot be modified.
              </p>
              <TickerPointValueManager
                tickerValues={tickerValues}
                onAdd={handleAddTickerValue}
                onDelete={handleDeleteTickerValue}
              />
            </div>
          </SettingsSection>

          <SettingsSection title="Trading Strategies">
            <StrategyManager
              strategies={strategies}
              onAdd={handleAddStrategy}
              onDelete={handleDeleteStrategy}
            />
          </SettingsSection>

          {isAdmin && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <button
                onClick={() => setShowAdminPanel(true)}
                className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-medium text-gray-900">Admin Panel</h2>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    Admin Access
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <AdminPanel user={user} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;