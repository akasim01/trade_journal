import { Trade } from '../types';
import { addMinutes, subDays, format, startOfMonth } from 'date-fns';

interface DummyDataConfig {
  startDate: Date;
  numberOfDays: number;
  tradesPerDay: number;
  winRate: number;
  avgProfitAmount: number;
  avgLossAmount: number;
  commission: number;
}

const DEFAULT_CONFIG: DummyDataConfig = {
  startDate: new Date(),
  numberOfDays: 30,
  tradesPerDay: 5,
  winRate: 0.65,
  avgProfitAmount: 150,
  avgLossAmount: 100,
  commission: 0.65
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateDummyTrades = (userId: string, config: Partial<DummyDataConfig> = {}): Omit<Trade, 'duration_seconds'>[] => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const trades: Omit<Trade, 'duration_seconds'>[] = [];
  const tickers = ['ES', 'NQ', 'MES', 'MNQ'];

  for (let day = 0; day < finalConfig.numberOfDays; day++) {
    const currentDate = subDays(finalConfig.startDate, day);
    const formattedDate = format(currentDate, 'yyyy-MM-dd');

    for (let i = 0; i < finalConfig.tradesPerDay; i++) {
      const isWinningTrade = Math.random() < finalConfig.winRate;
      const ticker = tickers[Math.floor(Math.random() * tickers.length)];
      const direction = Math.random() > 0.5 ? 'long' : 'short';
      const contracts = Math.floor(Math.random() * 3) + 1;

      const profitLoss = isWinningTrade
        ? finalConfig.avgProfitAmount * (0.5 + Math.random())
        : -finalConfig.avgLossAmount * (0.5 + Math.random());

      const marketOpenHour = 9;
      const marketCloseHour = 16;
      const tradeStartHour = marketOpenHour + Math.floor(Math.random() * (marketCloseHour - marketOpenHour));
      const tradeStartMinute = Math.floor(Math.random() * 60);
      const tradeDurationMinutes = Math.floor(Math.random() * 120) + 5;

      const entryTime = new Date(currentDate);
      entryTime.setHours(tradeStartHour, tradeStartMinute, 0, 0);
      const exitTime = addMinutes(entryTime, tradeDurationMinutes);

      const totalCommission = contracts * finalConfig.commission;
      const netProfit = profitLoss - totalCommission;

      trades.push({
        id: generateUUID(),
        user_id: userId,
        created_at: new Date().toISOString(),
        date: formattedDate,
        entry_time: entryTime.toISOString(),
        exit_time: exitTime.toISOString(),
        ticker,
        direction,
        contracts,
        profit_loss: profitLoss,
        commission_per_contract: finalConfig.commission,
        net_profit: netProfit,
        notes: `Dummy trade for testing`
      });
    }
  }

  return trades;
};

export const insertDummyTrades = async (supabase: any, userId: string, config?: Partial<DummyDataConfig>) => {
  const startDate = startOfMonth(new Date(2024, 1));
  const dummyTrades = generateDummyTrades(userId, {
    ...config,
    startDate,
    numberOfDays: new Date().getDate(),
    tradesPerDay: Math.floor(Math.random() * 3) + 3,
    winRate: 0.60,
    avgProfitAmount: 175,
    avgLossAmount: 125
  });
  
  // Insert trades in batches of 50 to avoid potential rate limits
  const batchSize = 50;
  for (let i = 0; i < dummyTrades.length; i += batchSize) {
    const batch = dummyTrades.slice(i, i + batchSize);
    const { error } = await supabase.from('trades').insert(batch);
    if (error) {
      console.error('Error inserting dummy trades:', error);
      throw error;
    }
  }

  return dummyTrades.length;
};

export const clearDummyTrades = async (supabase: any, userId: string) => {
  const { data: trades, error: fetchError } = await supabase
    .from('trades')
    .select('id')
    .eq('user_id', userId)
    .eq('notes', 'Dummy trade for testing');

  if (fetchError) {
    console.error('Error fetching dummy trades:', fetchError);
    throw fetchError;
  }

  if (!trades || trades.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('trades')
    .delete()
    .in('id', trades.map(t => t.id));

  if (deleteError) {
    console.error('Error deleting dummy trades:', deleteError);
    throw deleteError;
  }
};