import { User } from '@supabase/supabase-js';

export type DateRangePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export interface TrendData {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardMetrics {
  totalNetPL: TrendData;
  winRate: TrendData;
  avgWinningTrade: TrendData;
  avgLosingTrade: TrendData;
  profitFactor: TrendData;
}

export interface AnalyticsMetrics {
  totalNetPL: TrendData;
  tradingFrequency: TrendData;
  profitFactor: TrendData;
  avgWinningTrade: TrendData;
  avgLosingTrade: TrendData;
}

export type AIProvider = 'openai' | 'anthropic';
export type OpenAIModel = 'gpt-4o' | 'o3-mini';
export type ClaudeModel = 'claude-3-5-sonnet-20240620';
export type AIModel = OpenAIModel | ClaudeModel;

export interface UserSettings {
  user_id: string;
  timezone: string;
  currency: string;
  default_commission: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  user_id: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  currency: 'USD',
  default_commission: 0.65
};

export interface Trade {
  id: string;
  user_id: string;
  created_at: string;
  date: string;
  entry_time: string;
  exit_time: string;
  duration_seconds: number;
  ticker: string;
  direction: 'long' | 'short';
  contracts: number;
  profit_loss: number;
  entry_price?: number;
  stop_loss?: number;
  target_price?: number;
  timeframe?: string;
  commission_per_contract: number;
  net_profit: number;
  notes?: string;
  snapshot_url?: string;
  strategy_id?: string | null;
}

export interface UserTicker {
  id: string;
  user_id: string;
  ticker: string;
  created_at: string;
}

export interface UserStrategy {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface BrokerConfig {
  id: string;
  user_id: string;
  broker_name: string;
  field_mappings: Record<string, string>;
  created_at: string;
}

export interface CSVPreviewData {
  headers: string[];
  rows: string[][];
}

export interface MappedTrade {
  valid: boolean;
  errors: string[];
  id?: string;
  user_id?: string;
  date?: string;
  entry_time?: string;
  exit_time?: string;
  ticker?: string;
  direction?: 'long' | 'short';
  contracts?: number;
  profit_loss?: number;
  commission_per_contract?: number;
  net_profit?: number;
  notes?: string;
  snapshot_url?: string;
  strategy_id?: string | null;
}

export interface TradePattern {
  id: string;
  user_id: string;
  pattern_type: string;
  pattern_data: any;
  visualization_config?: {
    chart_type?: string;
    color_scheme?: string[];
    display_options?: Record<string, any>;
  };
  confidence_score: number;
  success_rate: number;
  sample_size: number;
  created_at: string;
  updated_at: string;
}

export interface PatternMatch {
  id: string;
  pattern_id: string;
  trade_id: string;
  match_score: number;
  created_at: string;
}

export interface TradePattern {
  id: string;
  user_id: string;
  pattern_type: string;
  pattern_data: any;
  visualization_config?: {
    chart_type?: string;
    color_scheme?: string[];
    display_options?: Record<string, any>;
  };
  confidence_score: number;
  success_rate: number;
  sample_size: number;
  created_at: string;
  updated_at: string;
}

export interface PatternMatch {
  id: string;
  pattern_id: string;
  trade_id: string;
  match_score: number;
  created_at: string;
}

export interface DurationStats {
  averageDuration: number;
  shortTradeWinRate: number;
  longTradeWinRate: number;
  profitByDuration: {
    duration: string;
    profit: number;
    trades: number;
  }[];
  timeOfDayStats: {
    hour: number;
    trades: number;
    profit: number;
  }[];
}

export interface AIMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  message: string;
  response: string;
  context?: any;
  created_at: string;
  message_order: number;
}

export interface AIInsight {
  id: string;
  user_id: string;
  type: 'performance' | 'psychology' | 'pattern' | 'risk';
  content: {
    title: string;
    description: string;
    metrics?: Record<string, any>;
    recommendations?: string[];
  };
  created_at: string;
}

export interface TradingPlan {
  id: string;
  user_id: string;
  date: string;
  market_bias?: string;
  key_levels?: string[];
  economic_events?: {
    time: string;
    event: string;
    impact: 'high' | 'medium' | 'low';
  }[];
  news_impact?: string;
  max_daily_loss?: number;
  created_at: string;
  updated_at: string;
}

export interface TradePlan {
  id: string;
  trading_plan_id: string;
  trade_id?: string;
  ticker: string;
  direction: 'long' | 'short';
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_amount: number;
  reward_amount: number;
  max_position_size: number;
  entry_criteria?: string;
  exit_criteria?: string;
  timeframe?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  first_message: string;
}

export interface TickerPointValue {
  id: string;
  user_id: string | null;
  ticker: string;
  point_value: number;
  is_system: boolean;
  created_at: string;
}

export interface PatternRecommendation {
  id: string;
  pattern_id: string;
  user_id: string;
  ticker: string;
  direction: 'long' | 'short';
  entry_zone: {
    lower: number;
    upper: number;
  };
  stop_loss: number;
  target_price: number;
  confidence_score: number;
  expiration: string;
  status: 'pending' | 'triggered' | 'expired' | 'invalidated';
  created_at: string;
  updated_at: string;
}

export interface PatternVisualizationSettings {
  id: string;
  user_id: string;
  pattern_type: string;
  chart_type: string;
  color_scheme: string[];
  display_options: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PatternVisualizationData {
  id: string;
  pattern_id: string;
  chart_data: any;
  time_range: string;
  aggregation_level: string;
  created_at: string;
  updated_at: string;
}

export interface PatternChartConfig {
  type: 'line' | 'bar' | 'scatter' | 'area' | 'candlestick';
  timeRange: string;
  aggregation: string;
  metrics: string[];
  displayOptions: {
    showConfidenceBands?: boolean;
    showTrendlines?: boolean;
    showAnnotations?: boolean;
    showLegend?: boolean;
  };
}