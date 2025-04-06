import { Trade } from '../types';
import { format, parseISO, differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns';

export const formatTradeDuration = (durationSeconds: number): string => {
  const duration = intervalToDuration({ start: 0, end: durationSeconds * 1000 });
  return formatDuration(duration, {
    format: ['hours', 'minutes', 'seconds'],
    zero: false,
  });
};

export const getDurationCategory = (durationSeconds: number): string => {
  const hours = durationSeconds / 3600;
  if (hours < 1) return 'Under 1 hour';
  if (hours < 4) return '1-4 hours';
  if (hours < 8) return '4-8 hours';
  return 'Over 8 hours';
};

export const calculateDurationStats = (trades: Trade[]) => {
  const tradesWithDuration = trades.filter(trade => 
    trade.entry_time && trade.exit_time && trade.duration_seconds
  );

  if (tradesWithDuration.length === 0) {
    return {
      averageDuration: 0,
      shortTradeWinRate: 0,
      longTradeWinRate: 0,
      profitByDuration: [],
      timeOfDayStats: []
    };
  }

  // Calculate average duration
  const totalDuration = tradesWithDuration.reduce(
    (sum, trade) => sum + (trade.duration_seconds || 0),
    0
  );
  const averageDuration = totalDuration / tradesWithDuration.length;

  // Calculate win rates by duration
  const shortTrades = tradesWithDuration.filter(t => (t.duration_seconds || 0) < 3600);
  const longTrades = tradesWithDuration.filter(t => (t.duration_seconds || 0) >= 3600);

  const shortTradeWinRate = shortTrades.length
    ? (shortTrades.filter(t => t.net_profit > 0).length / shortTrades.length) * 100
    : 0;

  const longTradeWinRate = longTrades.length
    ? (longTrades.filter(t => t.net_profit > 0).length / longTrades.length) * 100
    : 0;

  // Calculate profit by duration category
  const profitByDuration = Object.entries(
    tradesWithDuration.reduce((acc: { [key: string]: { profit: number; trades: number } }, trade) => {
      const category = getDurationCategory(trade.duration_seconds || 0);
      if (!acc[category]) {
        acc[category] = { profit: 0, trades: 0 };
      }
      acc[category].profit += trade.net_profit;
      acc[category].trades += 1;
      return acc;
    }, {})
  ).map(([duration, stats]) => ({
    duration,
    profit: stats.profit,
    trades: stats.trades
  }));

  // Calculate time of day statistics
  const timeOfDayStats = Array.from({ length: 24 }, (_, hour) => {
    const tradesInHour = tradesWithDuration.filter(trade => {
      const entryHour = new Date(trade.entry_time!).getHours();
      return entryHour === hour;
    });

    return {
      hour,
      trades: tradesInHour.length,
      profit: tradesInHour.reduce((sum, trade) => sum + trade.net_profit, 0)
    };
  });

  return {
    averageDuration,
    shortTradeWinRate,
    longTradeWinRate,
    profitByDuration,
    timeOfDayStats
  };
};