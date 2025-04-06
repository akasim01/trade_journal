import { Trade } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';

export const calculateAdvancedMetrics = (trades: Trade[]) => {
  if (!trades.length) {
    return {
      roi: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      valueAtRisk: 0,
      stopLossEfficiency: 0,
      riskRewardRatio: 0,
      equityCurve: [],
      profitDistribution: [],
      winRateByTime: [],
      positionSizeAnalysis: [],
      performanceByVolatility: [],
      consecutiveTradesAnalysis: []
    };
  }

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate daily returns
  const dailyReturns = calculateDailyReturns(sortedTrades);
  
  // Calculate core metrics
  const totalProfit = trades.reduce((sum, trade) => sum + trade.net_profit, 0);
  const initialCapital = 100000; // Assuming initial capital of $100,000
  const roi = (totalProfit / initialCapital) * 100;

  // Risk metrics
  const returns = trades.map(trade => trade.net_profit / initialCapital);
  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const stdDev = calculateStandardDeviation(returns);
  const downstdDev = calculateDownsideDeviation(returns);
  
  const riskFreeRate = 0.02; // Assuming 2% risk-free rate
  const sharpeRatio = calculateSharpeRatio(avgReturn, stdDev, riskFreeRate);
  const sortinoRatio = calculateSortinoRatio(avgReturn, downstdDev, riskFreeRate);

  // Maximum drawdown
  const maxDrawdown = calculateMaxDrawdown(sortedTrades, initialCapital);

  // Value at Risk (95% confidence)
  const valueAtRisk = calculateValueAtRisk(returns, initialCapital);

  // Stop-loss efficiency
  const stopLossEfficiency = calculateStopLossEfficiency(trades);

  // Risk/Reward Ratio
  const riskRewardRatio = calculateRiskRewardRatio(trades);

  // Equity curve
  const equityCurve = calculateEquityCurve(sortedTrades, initialCapital);

  // Profit distribution
  const profitDistribution = calculateProfitDistribution(trades);

  // Win rate by time of day
  const winRateByTime = calculateWinRateByTime(trades);

  // Position size analysis
  const positionSizeAnalysis = calculatePositionSizeAnalysis(trades);

  // Performance by volatility
  const performanceByVolatility = calculatePerformanceByVolatility(trades);

  // Consecutive trades analysis
  const consecutiveTradesAnalysis = calculateConsecutiveTradesAnalysis(trades);

  return {
    roi,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    valueAtRisk,
    stopLossEfficiency,
    riskRewardRatio,
    equityCurve,
    profitDistribution,
    winRateByTime,
    positionSizeAnalysis,
    performanceByVolatility,
    consecutiveTradesAnalysis
  };
};

function calculateDailyReturns(trades: Trade[]): number[] {
  const dailyProfits = trades.reduce((acc: { [key: string]: number }, trade) => {
    const date = trade.date;
    acc[date] = (acc[date] || 0) + trade.net_profit;
    return acc;
  }, {});

  return Object.values(dailyProfits);
}

function calculateStandardDeviation(values: number[]): number {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

function calculateDownsideDeviation(returns: number[]): number {
  const negativeReturns = returns.filter(ret => ret < 0);
  return calculateStandardDeviation(negativeReturns);
}

function calculateSharpeRatio(avgReturn: number, stdDev: number, riskFreeRate: number): number {
  return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
}

function calculateSortinoRatio(avgReturn: number, downstdDev: number, riskFreeRate: number): number {
  return downstdDev === 0 ? 0 : (avgReturn - riskFreeRate) / downstdDev;
}

function calculateMaxDrawdown(trades: Trade[], initialCapital: number): number {
  let peak = initialCapital;
  let maxDrawdown = 0;
  let currentCapital = initialCapital;

  trades.forEach(trade => {
    currentCapital += trade.net_profit;
    peak = Math.max(peak, currentCapital);
    const drawdown = (peak - currentCapital) / peak * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  return maxDrawdown;
}

function calculateValueAtRisk(returns: number[], capital: number): number {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const varIndex = Math.floor(returns.length * 0.05);
  return -sortedReturns[varIndex] * capital;
}

function calculateStopLossEfficiency(trades: Trade[]): number {
  const losingTrades = trades.filter(trade => trade.net_profit < 0);
  const avgLoss = losingTrades.reduce((sum, trade) => sum + trade.net_profit, 0) / losingTrades.length;
  const maxLoss = Math.min(...trades.map(trade => trade.net_profit));
  return avgLoss === 0 ? 0 : (maxLoss / avgLoss) * 100;
}

function calculateRiskRewardRatio(trades: Trade[]): number {
  const winningTrades = trades.filter(trade => trade.net_profit > 0);
  const losingTrades = trades.filter(trade => trade.net_profit < 0);

  const avgWin = winningTrades.reduce((sum, trade) => sum + trade.net_profit, 0) / winningTrades.length;
  const avgLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.net_profit, 0) / losingTrades.length);

  return avgLoss === 0 ? 0 : avgWin / avgLoss;
}

function calculateEquityCurve(trades: Trade[], initialCapital: number): any[] {
  let capital = initialCapital;
  return trades.map(trade => {
    capital += trade.net_profit;
    return {
      date: trade.date,
      value: capital
    };
  });
}

function calculateProfitDistribution(trades: Trade[]): any[] {
  const profits = trades.map(trade => trade.net_profit);
  const min = Math.floor(Math.min(...profits));
  const max = Math.ceil(Math.max(...profits));
  const range = max - min;
  const bucketSize = range / 10;

  const distribution: { [key: string]: number } = {};
  profits.forEach(profit => {
    const bucket = Math.floor((profit - min) / bucketSize);
    const bucketRange = `$${(min + bucket * bucketSize).toFixed(0)} to $${(min + (bucket + 1) * bucketSize).toFixed(0)}`;
    distribution[bucketRange] = (distribution[bucketRange] || 0) + 1;
  });

  return Object.entries(distribution).map(([range, count]) => ({ range, count }));
}

function calculateWinRateByTime(trades: Trade[]): any[] {
  const hourlyStats: { [key: number]: { wins: number; total: number; pnl: number } } = {};
  
  trades.forEach(trade => {
    const hour = new Date(trade.entry_time || trade.date).getHours();
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = { wins: 0, total: 0, pnl: 0 };
    }
    hourlyStats[hour].total++;
    hourlyStats[hour].pnl += trade.net_profit;
    if (trade.net_profit > 0) {
      hourlyStats[hour].wins++;
    }
  });

  return Object.entries(hourlyStats).map(([hour, stats]) => ({
    hour: parseInt(hour),
    winRate: (stats.wins / stats.total) * 100,
    trades: stats.total,
    avgPnL: stats.pnl / stats.total
  }));
}

function calculatePositionSizeAnalysis(trades: Trade[]): any[] {
  return trades.map(trade => ({
    contracts: trade.contracts,
    return: (trade.net_profit / (trade.contracts * trade.commission_per_contract)) * 100,
    frequency: 1
  }));
}

function calculatePerformanceByVolatility(trades: Trade[]): any[] {
  // Simplified volatility calculation using daily range
  const volatilityBuckets: { [key: string]: { wins: number; total: number } } = {
    'Low': { wins: 0, total: 0 },
    'Medium': { wins: 0, total: 0 },
    'High': { wins: 0, total: 0 }
  };

  trades.forEach(trade => {
    const profitPercent = Math.abs(trade.net_profit / (trade.contracts * trade.commission_per_contract)) * 100;
    let volatility = 'Medium';
    if (profitPercent < 1) volatility = 'Low';
    else if (profitPercent > 5) volatility = 'High';

    volatilityBuckets[volatility].total++;
    if (trade.net_profit > 0) {
      volatilityBuckets[volatility].wins++;
    }
  });

  return Object.entries(volatilityBuckets).map(([volatility, stats]) => ({
    volatility,
    winRate: (stats.wins / stats.total) * 100
  }));
}

function calculateConsecutiveTradesAnalysis(trades: Trade[]): any[] {
  let currentStreak = 1;
  let isWinning = trades[0]?.net_profit > 0;
  const streaks: { wins: number; losses: number }[] = Array(10).fill({ wins: 0, losses: 0 });

  trades.slice(1).forEach(trade => {
    const isCurrentWinning = trade.net_profit > 0;
    if (isCurrentWinning === isWinning) {
      currentStreak++;
    } else {
      const index = Math.min(currentStreak - 1, 9);
      if (isWinning) {
        streaks[index] = { ...streaks[index], wins: streaks[index].wins + 1 };
      } else {
        streaks[index] = { ...streaks[index], losses: streaks[index].losses + 1 };
      }
      currentStreak = 1;
      isWinning = isCurrentWinning;
    }
  });

  return streaks.map((streak, index) => ({
    streak: `${index + 1}`,
    ...streak
  }));
}