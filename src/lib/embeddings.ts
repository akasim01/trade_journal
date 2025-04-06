import { Trade } from '../types';
import { supabase } from './supabase';
import OpenAI from 'openai';
import { formatCurrency } from '../utils/format';
import { TradingPlan, TradePlan } from '../types';

class EmbeddingsService {
  private client: OpenAI | null = null;
  private userId: string;
  private initialized: boolean = false;
  private readonly SIMILARITY_THRESHOLD = 0.7;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.initialized && this.client) return true;
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        return false;
      }
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return false;
      }

      const { data: config, error } = await supabase
        .from('user_ai_configs')
        .select('api_key')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // If no config exists or there's an error, that's okay - embeddings are optional
      if (error || !config || !config.api_key) {
        console.log('No AI configuration found - embeddings will be disabled');
        return false;
      }

      this.client = new OpenAI({
        apiKey: config.api_key,
        dangerouslyAllowBrowser: true
      });

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing embeddings service:', error);
      return false;
    }
  }

  async searchSimilarPlans(query: string, threshold: number = this.SIMILARITY_THRESHOLD, limit: number = 5): Promise<{plan: TradingPlan, tradePlans: TradePlan[]}[]> {
    try {
      if (!this.initialized || !this.client) {
        const success = await this.initialize();
        if (!success) {
          console.error('Failed to initialize embeddings service');
          return [];
        }
      }

      // Generate query embedding
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received');
      }

      const queryEmbedding = response.data[0].embedding;

      // Search for similar plans using Supabase's vector similarity search
      const { data: similarEmbeddings, error: searchError } = await supabase.rpc(
        'search_plan_embeddings',
        {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          user_id_input: this.userId
        }
      );

      if (searchError) {
        console.error('Error searching plan embeddings:', searchError);
        return [];
      }

      if (!similarEmbeddings || similarEmbeddings.length === 0) {
        return [];
      }

      // Fetch the actual plans and their trade plans
      const results = await Promise.all(
        similarEmbeddings.map(async (embedding) => {
          const { data: plan, error: planError } = await supabase
            .from('trading_plans')
            .select('*')
            .eq('id', embedding.trading_plan_id)
            .eq('user_id', this.userId)
            .single();

          if (planError) {
            console.error('Error fetching plan:', planError);
            return null;
          }

          const { data: tradePlans, error: tradePlansError } = await supabase
            .from('trade_plans')
            .select('*')
            .eq('trading_plan_id', plan.id)
            .order('created_at', { ascending: true });

          if (tradePlansError) {
            console.error('Error fetching trade plans:', tradePlansError);
            return null;
          }

          return { plan, tradePlans: tradePlans || [] };
        })
      );

      return results.filter((result): result is {plan: TradingPlan, tradePlans: TradePlan[]} => result !== null);
    } catch (error) {
      console.error('Error searching similar plans:', error);
      return [];
    }
  }

  private generateTradeContent(trade: Trade): string {
    const parts = [
      `Date: ${trade.date}`,
      `Ticker: ${trade.ticker}`,
      `Direction: ${trade.direction.toUpperCase()}`,
      `Contracts: ${trade.contracts}`,
      `Entry Time: ${new Date(trade.entry_time).toLocaleTimeString()}`,
      `Exit Time: ${new Date(trade.exit_time).toLocaleTimeString()}`,
      `P&L: ${formatCurrency(trade.profit_loss, 'USD')}`,
      `Net P&L: ${formatCurrency(trade.net_profit, 'USD')}`,
      trade.notes ? `Notes: ${trade.notes}` : null,
      trade.strategy_id ? `Has Strategy: Yes` : null
    ].filter(Boolean);

    return parts.join('\n');
  }

  async createEmbedding(trade: Trade): Promise<boolean> {
    try {
      // Check for required trade data
      if (!trade.id || !trade.user_id) {
        console.error('Missing required trade data:', { id: trade.id, user_id: trade.user_id });
        return false;
      }

      if (!trade.id || !trade.user_id) {
        console.error('Missing required trade data:', { id: trade.id, user_id: trade.user_id });
        return false;
      }

      if (!this.initialized || !this.client) {
        const success = await this.initialize();
        if (!success) {
          console.error('Failed to initialize embeddings service');
          return false;
        }
      }

      const content = this.generateTradeContent(trade);

      // Generate embedding using OpenAI
      const response = await this.client!.embeddings.create({
        model: 'text-embedding-3-small',
        input: content,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received');
      }

      const embedding = response.data[0].embedding;

      // Check for existing embedding first
      const { data: existingEmbedding, error: checkError } = await supabase
        .from('trade_embeddings')
        .select('id')
        .eq('trade_id', trade.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing embedding:', checkError);
        return false;
      }

      // Update or insert embedding
      const { error: upsertError } = await supabase
        .from('trade_embeddings')
        [existingEmbedding ? 'update' : 'insert']({
          ...(existingEmbedding ? {} : { id: crypto.randomUUID() }),
          trade_id: trade.id,
          user_id: this.userId,
          content,
          embedding
        })
        [existingEmbedding ? 'eq' : 'select'](...(existingEmbedding ? ['id', existingEmbedding.id] : []));

      if (upsertError) throw upsertError;

      return true;
    } catch (error) {
      console.error('Error creating/updating embedding:', error);
      return false;
    }
  }

  async searchSimilarTrades(
    query: string,
    threshold: number = 0.7,
    limit: number = 5,
    dateRange?: { start: string; end: string }
  ): Promise<Trade[]> {
    try {
      if (!this.initialized || !this.client) {
        await this.initialize();
        // Return empty array if initialization fails
        if (!this.client) return [];
      }

      // Generate query embedding
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received');
      }

      const queryEmbedding = response.data[0].embedding;

      // Search for similar trades using Supabase's vector similarity search
      const { data: similarEmbeddings, error: searchError } = await supabase.rpc(
        'search_trade_embeddings',
        {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          user_id_input: this.userId
        }
      );

      if (searchError) {
        console.error('Error searching embeddings:', searchError);
        return [];
      }

      if (!similarEmbeddings || similarEmbeddings.length === 0) {
        return [];
      }
      
      // Build the query for fetching trades
      let tradesQuery = supabase
        .from('trades')
        .select('*')
        .in('id', similarEmbeddings.map(e => e.trade_id))
        .eq('user_id', this.userId);
      
      // Add date range filters if provided
      if (dateRange) {
        tradesQuery = tradesQuery
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);
      }

      // Execute the query
      const { data: trades, error: tradesError } = await tradesQuery;

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        return [];
      }

      return trades || [];
    } catch (error) {
      console.error('Error searching similar trades:', error);
      return [];
    }
  }

  async deleteEmbedding(tradeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trade_embeddings')
        .delete()
        .eq('trade_id', tradeId)
        .eq('user_id', this.userId);

      if (error) {
        console.error('Error deleting plan embedding:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting embedding:', error);
      return false;
    }
  }

  async backfillEmbeddings(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
        // Continue even if initialization fails - embeddings are optional
      }

      // If client isn't initialized, skip backfill
      if (!this.client) {
        console.log('Embeddings client not initialized - skipping backfill');
        return;
      }

      // Get all trades
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', this.userId)
        .order('date', { ascending: false });

      if (tradesError) throw tradesError;
      if (!trades || trades.length === 0) return;

      // Get existing embeddings
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('trade_embeddings')
        .select('trade_id')
        .eq('user_id', this.userId);

      if (embeddingsError) throw embeddingsError;

      const existingIds = new Set(existingEmbeddings?.map(e => e.trade_id) || []);
      const tradesToProcess = trades.filter(trade => !existingIds.has(trade.id));

      if (tradesToProcess.length === 0) {
        console.log('No trades need embeddings backfill');
        return;
      }

      console.log(`Starting embeddings backfill for ${tradesToProcess.length} trades...`);

      // Process trades in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < tradesToProcess.length; i += batchSize) {
        const batch = tradesToProcess.slice(i, i + batchSize);
        await Promise.all(batch.map(trade => this.createEmbedding(trade)));
        
        // Add a small delay between batches
        if (i + batchSize < tradesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Successfully backfilled embeddings for ${tradesToProcess.length} trades`);
    } catch (error) {
      console.error('Error backfilling embeddings:', error);
    }
  }

  async createPlanEmbedding(plan: TradingPlan, tradePlans: TradePlan[]): Promise<boolean> {
    try {
      if (!this.initialized || !this.client) {
        const success = await this.initialize();
        if (!success) {
          console.error('Failed to initialize embeddings service');
          return false;
        }
      }

      // Generate content for embedding
      const content = this.generatePlanContent(plan, tradePlans);

      // Generate embedding using OpenAI
      const response = await this.client!.embeddings.create({
        model: 'text-embedding-3-small', 
        input: content,
        encoding_format: 'float',
      }).catch(error => {
        console.error('Error generating embedding:', error);
        throw error;
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received');
      }

      const embedding = response.data[0].embedding;

      // Check for existing embedding
      const { data: existingEmbedding, error: fetchError } = await supabase
        .from('plan_embeddings')
        .select('id')
        .eq('trading_plan_id', plan.id)
        .eq('user_id', this.userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error checking existing embedding:', fetchError);
        return false;
      }

      if (existingEmbedding) {
        // Update existing embedding
        const { error: updateError } = await supabase
          .from('plan_embeddings')
          .update({
            content,
            embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEmbedding.id);

        if (updateError) throw updateError;
      } else {
        // Insert new embedding
        const { error: insertError } = await supabase
          .from('plan_embeddings')
          .insert({
            trading_plan_id: plan.id,
            user_id: this.userId,
            content,
            embedding
          });

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error creating/updating plan embedding:', error);
      return false;
    }
  }

  private generatePlanContent(plan: TradingPlan, tradePlans: TradePlan[]): string {
    const parts = [
      `Trading plan for ${plan.date}`,
      plan.market_bias ? `Market bias: ${plan.market_bias}` : null,
      plan.key_levels?.length ? `Key levels: ${plan.key_levels.join(', ')}` : null,
      plan.news_impact ? `News impact: ${plan.news_impact}` : null,
      plan.max_daily_loss ? `Max daily loss: ${plan.max_daily_loss}` : null,
      tradePlans.length > 0 ? 'Trade setups:' : null,
      ...tradePlans.map(tp => 
        `${tp.ticker} ${tp.direction} setup - Entry: ${tp.entry_price}, Stop: ${tp.stop_loss}, Target: ${tp.target_price}`
      )
    ].filter(Boolean);

    return parts.join('\n');
  }

  async deletePlanEmbedding(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('plan_embeddings')
        .delete()
        .eq('trading_plan_id', planId)
        .eq('user_id', this.userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting plan embedding:', error);
      return false;
    }
  }
}

export { EmbeddingsService }