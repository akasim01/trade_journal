import { Trade, TradePattern, PatternMatch } from '../types';
import { supabase } from './supabase';
import { EmbeddingsService } from './embeddings';

export class PatternAnalysisService {
  private userId: string;
  private embeddingsService: EmbeddingsService;
  private readonly RISK_CATEGORIES = [
    'position_size',
    'drawdown',
    'volatility',
    'time_risk',
    'correlation',
    'concentration'
  ];
  private readonly SETUP_TYPES = [
    'breakout',
    'pullback',
    'reversal',
    'trend_continuation',
    'range_bound',
    'momentum'
  ];
  private readonly RECOMMENDATION_EXPIRY_HOURS = 24;

  constructor(userId: string) {
    this.userId = userId;
    this.embeddingsService = new EmbeddingsService(userId);
  }

  async initialize(): Promise<boolean> {
    try {
      await this.embeddingsService.initialize();
      return true;
    } catch (error) {
      console.error('Error initializing pattern analysis:', error);
      return false;
    }
  }

  async analyzeTimeBasedPatterns(trades: Trade[]): Promise<TradePattern[]> {
    try {
      const patterns: TradePattern[] = [];
      
      // Group trades by hour
      const tradesByHour = trades.reduce((acc: { [key: number]: Trade[] }, trade) => {
        const hour = new Date(trade.entry_time).getHours();
        if (!acc[hour]) acc[hour] = [];
        acc[hour].push(trade);
        return acc;
      }, {});

      // Analyze each hour
      for (const [hour, hourTrades] of Object.entries(tradesByHour)) {
        if (hourTrades.length < 5) continue; // Skip hours with too few trades

        const winningTrades = hourTrades.filter(t => t.net_profit > 0);
        const successRate = winningTrades.length / hourTrades.length;
        
        if (successRate > 0.6) { // Only store significant patterns
          patterns.push({
            id: crypto.randomUUID(),
            user_id: this.userId,
            pattern_type: 'time_based',
            pattern_data: {
              hour: parseInt(hour),
              avg_profit: hourTrades.reduce((sum, t) => sum + t.net_profit, 0) / hourTrades.length,
              avg_duration: hourTrades.reduce((sum, t) => sum + (t.duration_seconds || 0), 0) / hourTrades.length
            },
            confidence_score: Math.min(hourTrades.length / 20, 1), // Scale with sample size
            success_rate: successRate,
            sample_size: hourTrades.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      // Save patterns to database
      if (patterns.length > 0) {
        const { error } = await supabase
          .from('trade_patterns')
          .insert(patterns);

        if (error) throw error;
      }

      return patterns;
    } catch (error) {
      console.error('Error analyzing time-based patterns:', error);
      throw error;
    }
  }

  async analyzeSetupPatterns(trades: Trade[]): Promise<TradePattern[]> {
    try {
      const patterns: TradePattern[] = [];
      
      // Group trades by ticker
      const tradesByTicker = trades.reduce((acc: { [key: string]: Trade[] }, trade) => {
        if (!acc[trade.ticker]) acc[trade.ticker] = [];
        acc[trade.ticker].push(trade);
        return acc;
      }, {});

      // Analyze each ticker's trades
      for (const [ticker, tickerTrades] of Object.entries(tradesByTicker)) {
        if (tickerTrades.length < 10) continue; // Skip tickers with insufficient data

        // Analyze winning trades for common patterns
        const winningTrades = tickerTrades.filter(t => t.net_profit > 0);
        const winRate = winningTrades.length / tickerTrades.length;

        // Look for setup patterns
        for (const setupType of this.SETUP_TYPES) {
          const setupTrades = this.identifySetupTrades(tickerTrades, setupType);
          if (setupTrades.length < 5) continue;

          const setupWinRate = setupTrades.filter(t => t.net_profit > 0).length / setupTrades.length;
          const avgProfit = setupTrades.reduce((sum, t) => sum + t.net_profit, 0) / setupTrades.length;

          if (setupWinRate > winRate) { // Pattern shows better than average performance
            patterns.push({
              id: crypto.randomUUID(),
              user_id: this.userId,
              pattern_type: 'setup',
              setup_type: setupType,
              pattern_data: {
                ticker,
                avg_profit: avgProfit,
                avg_duration: setupTrades.reduce((sum, t) => sum + (t.duration_seconds || 0), 0) / setupTrades.length,
                entry_conditions: this.generateEntryConditions(setupTrades, setupType),
                exit_conditions: this.generateExitConditions(setupTrades, setupType)
              },
              pattern_tags: this.generatePatternTags(setupTrades, setupType),
              risk_metrics: this.calculateRiskMetrics(setupTrades),
              confidence_score: Math.min(setupTrades.length / 20, 1),
              success_rate: setupWinRate,
              sample_size: setupTrades.length,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      // Save patterns to database
      if (patterns.length > 0) {
        const { error } = await supabase
          .from('trade_patterns')
          .insert(patterns);

        if (error) throw error;
      }

      return patterns;
    } catch (error) {
      console.error('Error analyzing setup patterns:', error);
      throw error;
    }
  }

  async analyzeRiskPatterns(trades: Trade[]): Promise<TradePattern[]> {
    try {
      const patterns: TradePattern[] = [];
      
      // Analyze position sizing patterns
      const positionSizePattern = this.analyzePositionSizeRisk(trades);
      if (positionSizePattern) patterns.push(positionSizePattern);
      
      // Analyze drawdown patterns
      const drawdownPattern = this.analyzeDrawdownRisk(trades);
      if (drawdownPattern) patterns.push(drawdownPattern);
      
      // Analyze volatility patterns
      const volatilityPattern = this.analyzeVolatilityRisk(trades);
      if (volatilityPattern) patterns.push(volatilityPattern);
      
      // Analyze time-based risk patterns
      const timeRiskPattern = this.analyzeTimeRisk(trades);
      if (timeRiskPattern) patterns.push(timeRiskPattern);
      
      // Save patterns to database
      if (patterns.length > 0) {
        const { error } = await supabase
          .from('trade_patterns')
          .insert(patterns);

        if (error) throw error;
      }

      return patterns;
    } catch (error) {
      console.error('Error analyzing risk patterns:', error);
      throw error;
    }
  }

  private analyzePositionSizeRisk(trades: Trade[]): TradePattern | null {
    const positionSizes = trades.map(t => t.contracts);
    const avgSize = positionSizes.reduce((sum, size) => sum + size, 0) / trades.length;
    const maxSize = Math.max(...positionSizes);
    const sizeVariation = Math.sqrt(
      positionSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / trades.length
    );

    // Calculate risk score based on position size consistency
    const riskScore = Math.min(
      (sizeVariation / avgSize) * 50 + // Size variation component
      (maxSize / (avgSize * 2)) * 50,   // Max size component
      100
    );

    if (riskScore > 30) { // Only create pattern if risk is significant
      return {
        id: crypto.randomUUID(),
        user_id: this.userId,
        pattern_type: 'risk',
        risk_category: 'position_size',
        pattern_data: {
          avg_size: avgSize,
          max_size: maxSize,
          size_variation: sizeVariation
        },
        risk_score: riskScore,
        volatility_metrics: {
          size_volatility: sizeVariation / avgSize
        },
        confidence_score: Math.min(trades.length / 50, 1),
        success_rate: trades.filter(t => t.net_profit > 0).length / trades.length,
        sample_size: trades.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return null;
  }

  private analyzeDrawdownRisk(trades: Trade[]): TradePattern | null {
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peak = 0;

    // Calculate maximum drawdown
    trades.forEach(trade => {
      const balance = trade.net_profit;
      peak = Math.max(peak, balance);
      currentDrawdown = peak - balance;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    });

    // Calculate consecutive losses
    let maxConsecutiveLosses = 0;
    let currentLosses = 0;
    trades.forEach(trade => {
      if (trade.net_profit < 0) {
        currentLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    });

    const riskScore = Math.min(
      (maxDrawdown / peak) * 50 +        // Drawdown component
      (maxConsecutiveLosses / 5) * 50,   // Consecutive losses component
      100
    );

    if (riskScore > 30) {
      return {
        id: crypto.randomUUID(),
        user_id: this.userId,
        pattern_type: 'risk',
        risk_category: 'drawdown',
        pattern_data: {
          max_drawdown: maxDrawdown,
          max_consecutive_losses: maxConsecutiveLosses,
          peak_balance: peak
        },
        risk_score: riskScore,
        drawdown_metrics: {
          drawdown_percentage: (maxDrawdown / peak) * 100,
          recovery_factor: peak / maxDrawdown
        },
        confidence_score: Math.min(trades.length / 50, 1),
        success_rate: trades.filter(t => t.net_profit > 0).length / trades.length,
        sample_size: trades.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return null;
  }

  private analyzeVolatilityRisk(trades: Trade[]): TradePattern | null {
    const returns = trades.map(t => t.net_profit);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    const riskScore = Math.min(
      (volatility / Math.abs(avgReturn)) * 100,
      100
    );

    if (riskScore > 30) {
      return {
        id: crypto.randomUUID(),
        user_id: this.userId,
        pattern_type: 'risk',
        risk_category: 'volatility',
        pattern_data: {
          avg_return: avgReturn,
          volatility: volatility,
          sharpe_ratio: avgReturn / volatility
        },
        risk_score: riskScore,
        volatility_metrics: {
          daily_volatility: volatility,
          annualized_volatility: volatility * Math.sqrt(252)
        },
        confidence_score: Math.min(trades.length / 50, 1),
        success_rate: trades.filter(t => t.net_profit > 0).length / trades.length,
        sample_size: trades.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return null;
  }

  private analyzeTimeRisk(trades: Trade[]): TradePattern | null {
    const tradesByHour = trades.reduce((acc: { [key: number]: Trade[] }, trade) => {
      // Convert UTC to local time for accurate hour analysis
      const localDate = new Date(trade.entry_time);
      const hour = localDate.getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(trade);
      return acc;
    }, {});

    // Initialize hourly stats
    const hourlyStats = Array(24).fill(null).map((_, hour) => ({
      hour,
      trades: 0,
      total_pl: 0,
      losses: 0,
      max_loss: 0,
      risk_amount: 0
    }));

    // Calculate statistics for each hour
    Object.entries(tradesByHour).forEach(([hour, hourTrades]) => {
      const hourInt = parseInt(hour);
      const stats = hourlyStats[hourInt];
      
      stats.trades = hourTrades.length;
      stats.total_pl = hourTrades.reduce((sum, t) => sum + t.net_profit, 0);
      
      const losses = hourTrades.filter(t => t.net_profit < 0);
      stats.losses = losses.length;
      stats.max_loss = losses.length > 0 ? Math.min(...losses.map(t => t.net_profit)) : 0;
      
      // Calculate risk amount based on loss frequency and magnitude
      const lossRate = losses.length / hourTrades.length;
      const avgLoss = losses.length > 0 ? 
        Math.abs(losses.reduce((sum, t) => sum + t.net_profit, 0)) / losses.length : 0;
      
      stats.risk_amount = lossRate * avgLoss;
    });

    // Find the riskiest hour
    const riskiestHour = hourlyStats.reduce((max, curr) => 
      curr.risk_amount > max.risk_amount ? curr : max
    );

    // Calculate overall risk score
    const riskScore = Math.min(
      (Math.abs(riskiestHour.risk_amount) / 1000 * 50) +
      (riskiestHour.losses / (riskiestHour.trades || 1) * 50),
      100
    );

    if (riskScore > 30) {
      return {
        id: crypto.randomUUID(),
        user_id: this.userId,
        pattern_type: 'risk',
        risk_category: 'time_risk',
        pattern_data: {
          riskiest_hour: riskiestHour.hour,
          max_hourly_loss: riskiestHour.max_loss,
          trades_by_hour: hourlyStats.map(stats => ({
            hour: stats.hour,
            count: stats.trades,
            net_pl: stats.total_pl,
            risk_amount: stats.risk_amount,
            loss_rate: stats.trades > 0 ? (stats.losses / stats.trades) * 100 : 0
          }))
        },
        risk_score: riskScore,
        confidence_score: Math.min(trades.length / 50, 1),
        success_rate: trades.filter(t => t.net_profit > 0).length / trades.length,
        sample_size: trades.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return null;
  }

  async generateRecommendations(pattern: TradePattern): Promise<void> {
    try {
      // Get recent trades for this pattern
      const { data: matches } = await supabase
        .from('pattern_matches')
        .select('trade_id')
        .eq('pattern_id', pattern.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!matches?.length) return;

      // Get trade details
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .in('id', matches.map(m => m.trade_id));

      if (!trades?.length) return;

      // Calculate average metrics
      const avgProfit = trades.reduce((sum, t) => sum + t.net_profit, 0) / trades.length;
      const avgRisk = Math.abs(trades.reduce((sum, t) => sum + Math.min(0, t.net_profit), 0) / trades.length);
      
      // Generate recommendation
      const recommendation = {
        pattern_id: pattern.id,
        user_id: this.userId,
        ticker: pattern.pattern_data.ticker || trades[0].ticker,
        direction: pattern.pattern_data.preferred_direction || trades[0].direction,
        entry_zone: this.calculateEntryZone(trades),
        stop_loss: this.calculateStopLoss(trades),
        target_price: this.calculateTargetPrice(trades),
        confidence_score: Math.min(pattern.confidence_score * pattern.success_rate, 1),
        expiration: new Date(Date.now() + this.RECOMMENDATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      };

      // Save recommendation
      const { error } = await supabase
        .from('pattern_recommendations')
        .insert([recommendation]);

      if (error) throw error;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  private calculateEntryZone(trades: Trade[]): { lower: number; upper: number } {
    const entries = trades.map(t => parseFloat(t.entry_time));
    const avg = entries.reduce((sum, e) => sum + e, 0) / entries.length;
    const std = Math.sqrt(
      entries.reduce((sum, e) => sum + Math.pow(e - avg, 2), 0) / entries.length
    );
    return {
      lower: avg - std,
      upper: avg + std
    };
  }

  private calculateStopLoss(trades: Trade[]): number {
    const losses = trades
      .filter(t => t.net_profit < 0)
      .map(t => t.net_profit);
    return losses.length > 0
      ? Math.min(...losses) * 1.1 // Add 10% buffer
      : -Math.abs(trades[0].net_profit); // Use first trade as reference
  }

  private calculateTargetPrice(trades: Trade[]): number {
    const profits = trades
      .filter(t => t.net_profit > 0)
      .map(t => t.net_profit);
    return profits.length > 0
      ? Math.max(...profits) * 0.9 // Conservative target
      : Math.abs(trades[0].net_profit); // Use first trade as reference
  }

  private identifySetupTrades(trades: Trade[], setupType: string): Trade[] {
    // Implement pattern recognition logic for each setup type
    switch (setupType) {
      case 'breakout':
        return trades.filter(t => this.isBreakoutTrade(t));
      case 'pullback':
        return trades.filter(t => this.isPullbackTrade(t));
      case 'reversal':
        return trades.filter(t => this.isReversalTrade(t));
      case 'trend_continuation':
        return trades.filter(t => this.isTrendContinuationTrade(t));
      case 'range_bound':
        return trades.filter(t => this.isRangeBoundTrade(t));
      case 'momentum':
        return trades.filter(t => this.isMomentumTrade(t));
      default:
        return [];
    }
  }

  private isBreakoutTrade(trade: Trade): boolean {
    // Implement breakout pattern detection
    return trade.duration_seconds < 1800; // Example: Short duration trades
  }

  private isPullbackTrade(trade: Trade): boolean {
    // Implement pullback pattern detection
    return trade.duration_seconds > 1800 && trade.duration_seconds < 3600;
  }

  private isReversalTrade(trade: Trade): boolean {
    // Implement reversal pattern detection
    return trade.net_profit > 100; // Example: High profit trades
  }

  private isTrendContinuationTrade(trade: Trade): boolean {
    // Implement trend continuation pattern detection
    return trade.duration_seconds > 3600;
  }

  private isRangeBoundTrade(trade: Trade): boolean {
    // Implement range bound pattern detection
    return trade.net_profit > 0 && trade.net_profit < 100;
  }

  private isMomentumTrade(trade: Trade): boolean {
    // Implement momentum pattern detection
    return trade.duration_seconds < 900; // Example: Very short duration trades
  }

  private generateEntryConditions(trades: Trade[], setupType: string): string[] {
    // Generate entry conditions based on pattern type
    const conditions: string[] = [];
    
    switch (setupType) {
      case 'breakout':
        conditions.push('Price breaks above resistance');
        conditions.push('Volume increases on breakout');
        break;
      case 'pullback':
        conditions.push('Price pulls back to moving average');
        conditions.push('Previous trend remains intact');
        break;
      // Add conditions for other setup types
    }

    return conditions;
  }

  private generateExitConditions(trades: Trade[], setupType: string): string[] {
    // Generate exit conditions based on pattern type
    const conditions: string[] = [];
    
    switch (setupType) {
      case 'breakout':
        conditions.push('Price reaches target extension');
        conditions.push('Volume decreases significantly');
        break;
      case 'pullback':
        conditions.push('Price resumes original trend');
        conditions.push('Moving average begins to flatten');
        break;
      // Add conditions for other setup types
    }

    return conditions;
  }

  private generatePatternTags(trades: Trade[], setupType: string): string[] {
    const tags = [setupType];
    
    // Add performance-based tags
    const avgProfit = trades.reduce((sum, t) => sum + t.net_profit, 0) / trades.length;
    if (avgProfit > 100) tags.push('high_profit');
    
    // Add time-based tags
    const avgDuration = trades.reduce((sum, t) => sum + (t.duration_seconds || 0), 0) / trades.length;
    if (avgDuration < 1800) tags.push('short_term');
    else if (avgDuration > 3600) tags.push('long_term');
    
    return tags;
  }

  private calculateRiskMetrics(trades: Trade[]): any {
    const winningTrades = trades.filter(t => t.net_profit > 0);
    const losingTrades = trades.filter(t => t.net_profit < 0);
    
    const avgWin = winningTrades.reduce((sum, t) => sum + t.net_profit, 0) / winningTrades.length;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.net_profit, 0) / losingTrades.length);
    
    return {
      risk_reward_ratio: avgWin / avgLoss,
      max_drawdown: Math.min(...trades.map(t => t.net_profit)),
      win_rate: winningTrades.length / trades.length,
      profit_factor: Math.abs(
        winningTrades.reduce((sum, t) => sum + t.net_profit, 0) /
        losingTrades.reduce((sum, t) => sum + t.net_profit, 0)
      )
    };
  }

  async findSimilarTrades(trade: Trade): Promise<PatternMatch[]> {
    try {
      const similarTrades = await this.embeddingsService.searchSimilarTrades(
        JSON.stringify({
          ticker: trade.ticker,
          direction: trade.direction,
          duration: trade.duration_seconds,
          profit: trade.net_profit
        }),
        0.7,
        5
      );

      return similarTrades.map(t => ({
        id: crypto.randomUUID(),
        pattern_id: '', // Will be set when pattern is created
        trade_id: t.id,
        match_score: 0.8, // Placeholder - implement proper scoring
        created_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error finding similar trades:', error);
      throw error;
    }
  }
}