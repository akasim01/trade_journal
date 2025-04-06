import OpenAI from 'openai';
import { supabase } from './supabase';
import { Trade, UserStrategy, AIMessage, AIInsight, OpenAIModel } from '../types';
import { format, parseISO } from 'date-fns';
import { EmbeddingsService } from './embeddings';

export class AIService {
  private client: OpenAI | null = null;
  private userId: string;
  private model: OpenAIModel = 'gpt-4o';
  private retryDelay = 1000;
  private maxRetries = 3;
  private embeddingsService: EmbeddingsService; 

  constructor(userId: string) {
    this.userId = userId;
    this.embeddingsService = new EmbeddingsService(userId);
  }

  private async ensureInitialized() {
    if (!this.client) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize AI service');
      }
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries,
    initialDelay = this.retryDelay
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries === 0) throw error;

      // Extract retry delay from rate limit error
      let retryDelay = initialDelay;
      if (error?.error?.type === 'tokens' && error?.error?.message) {
        const match = error.error.message.match(/try again in (\d+\.?\d*)s/);
        retryDelay = match ? Math.ceil(parseFloat(match[1]) * 1000) : initialDelay;
      }

      console.log(`Rate limit hit, retrying in ${retryDelay}ms...`);
      await this.sleep(retryDelay);
      return this.retryWithBackoff(operation, retries - 1, retryDelay * 2);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const { data: config, error } = await supabase
        .from('user_ai_configs')
        .select('api_key, model')
        .eq('user_id', this.userId)
        .eq('provider', 'openai')
        .maybeSingle();

      if (error) {
        console.error('Error initializing AI service:', error);
        return false;
      }

      if (!config?.api_key) {
        return false;
      }

      this.client = new OpenAI({
        apiKey: config.api_key,
        dangerouslyAllowBrowser: true
      });

      if (config.model) {
        this.model = config.model as OpenAIModel;
      }

      // Initialize embeddings service
      await this.embeddingsService.initialize();

      return true;
    } catch (error) {
      console.error('Error initializing AI service:', error);
      return false;
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid API key format. OpenAI API keys must start with "sk-"');
    }

    try {
      const testClient = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      });

      const response = await testClient.models.list();
      return response.data.length > 0;
    } catch (error: any) {
      // Handle specific error cases
      if (error?.status === 401 || error?.error?.code === 'invalid_api_key') {
        throw new Error('Invalid API key');
      } else if (error?.status === 429 || error?.error?.code === 'rate_limit_exceeded') {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      } else if (error?.error?.code === 'insufficient_quota') {
        throw new Error('API key has insufficient quota');
      }

      // Log unexpected errors but provide a generic message
      console.error('Error validating OpenAI API key:', error);
      throw new Error('Failed to validate API key. Please try again.');
    }
  }

  async chat(message: string, context: any): Promise<string> {
    await this.ensureInitialized();

    const operation = async () => {
      // Search for relevant trades using embeddings
      let relevantTrades: Trade[] = [], relevantPlans: {plan: TradingPlan, tradePlans: TradePlan[]}[] = [];
      
      try {
        relevantTrades = await this.embeddingsService.searchSimilarTrades(message, 0.5, 5);
        relevantPlans = await this.embeddingsService.searchSimilarPlans(message, 0.5, 3);
      } catch (error) {
        console.error('Error searching similar trades:', error);
        // Continue without similar trades
      }

      // Enhance context with relevant trades
      const enhancedContext = {
        ...context,
        trades: relevantTrades.map(trade => ({
          date: trade.date,
          ticker: trade.ticker,
          direction: trade.direction,
          profit_loss: trade.profit_loss,
          net_profit: trade.net_profit,
          notes: trade.notes
        })),
        plans: relevantPlans.map(({ plan, tradePlans }) => ({
          date: plan.date,
          market_bias: plan.market_bias,
          key_levels: plan.key_levels,
          economic_events: plan.economic_events,
          news_impact: plan.news_impact,
          max_daily_loss: plan.max_daily_loss,
          trade_setups: tradePlans.map(tp => ({
            ticker: tp.ticker,
            direction: tp.direction,
            entry_price: tp.entry_price,
            stop_loss: tp.stop_loss,
            target_price: tp.target_price,
            risk_amount: tp.risk_amount,
            reward_amount: tp.reward_amount,
            max_position_size: tp.max_position_size,
            entry_criteria: tp.entry_criteria,
            exit_criteria: tp.exit_criteria
          }))
        }))
      };

      const systemPrompt = `You are an expert AI trading assistant with deep knowledge of trading psychology, technical analysis, and risk management. Your role is to help traders improve their performance by providing data-driven insights and psychological support.

Keep your responses clear, concise, and well-formatted. Focus on providing specific, actionable advice based on the available data.

${relevantTrades.length > 0 || relevantPlans.length > 0 ? 
  `I've found ${relevantTrades.length} similar trades and ${relevantPlans.length} relevant trading plans that might be helpful. I'll consider these when providing my response.` : ''}

Current context: ${JSON.stringify(enhancedContext)}

IMPORTANT INSTRUCTIONS:
1. Provide your response in clear, natural language
2. Use proper paragraphs and formatting for readability
3. Do not include any JSON or structured data formats
4. Do not include any system messages or metadata
5. Start your response directly with the relevant content
6. Be concise and to the point`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      let aiResponse = response.choices[0]?.message?.content || 'No response generated';

      // Clean up the response
      aiResponse = aiResponse
        .trim()
        // Remove any JSON-like structures
        .replace(/^\{[\s\S]*\}$/m, '')
        // Remove any system-like prefixes
        .replace(/^(System:|Assistant:|AI:|Bot:)/gim, '')
        // Remove any markdown code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove excessive newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Save chat history
      await supabase.from('ai_chat_history').insert({
        user_id: this.userId,
        message,
        response: aiResponse,
        context: enhancedContext
      });

      return aiResponse;
    };

    try {
      return await this.retryWithBackoff(operation);
    } catch (error) {
      console.error('Error in AI chat:', error);
      throw new Error('Failed to generate response. Please try again.');
    }
  }

  async generateInsights(trades: Trade[], type: AIInsight['type']): Promise<AIInsight> {
    await this.ensureInitialized();

    // Reduce token usage by limiting the number of trades analyzed
    const maxTrades = 50;
    const analyzedTrades = trades.slice(-maxTrades);

    const operation = async () => {
      const systemPrompt = this.buildInsightPrompt(type, analyzedTrades);
      
      const response = await this.client!.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate insights based on the trading data provided.' }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const responseText = response.choices[0]?.message?.content || '{}';
      let content;

      try {
        content = JSON.parse(responseText);
        
        // Validate content structure
        if (!content.title || !content.description || !content.metrics || !content.recommendations) {
          throw new Error('Invalid response format');
        }
      } catch (e) {
        console.error('Error parsing AI response:', e);
        content = {
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Analysis`,
          description: 'Analysis generation encountered an error. Please try again.',
          metrics: {
            strengths: [],
            weaknesses: [],
            patterns: [],
            concerns: [],
            positives: [],
            effective: []
          },
          recommendations: []
        };
      }

      const insight: Omit<AIInsight, 'id' | 'user_id' | 'created_at'> = {
        type,
        content
      };

      const { data, error } = await supabase
        .from('ai_insights')
        .insert({
          user_id: this.userId,
          ...insight
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    };

    try {
      return await this.retryWithBackoff(operation);
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error('Failed to generate insights. Please try again.');
    }
  }

  private buildInsightPrompt(type: AIInsight['type'], trades: Trade[]): string {
    let prompt = `You are an expert trading analyst. Analyze the provided trading data and generate insights focusing on ${type}. 

Keep your response concise and focused. Limit metrics and recommendations to the most important points.

Your response should be in this exact JSON format:
{
  "title": "Brief, specific title about the ${type} analysis",
  "description": "Detailed analysis of the findings",
  "metrics": {
    "strengths": ["2-3 key strengths"],
    "weaknesses": ["2-3 areas for improvement"],
    "patterns": ["2-3 key patterns"],
    "concerns": ["2-3 main concerns"],
    "positives": ["2-3 positive aspects"],
    "effective": ["2-3 effective strategies"]
  },
  "recommendations": ["3-4 specific, actionable recommendations"]
}

Trading data to analyze:
${trades.map(trade => this.formatTradeForContext(trade)).join('\n\n')}

Focus your analysis on:`;

    switch (type) {
      case 'performance':
        prompt += `
- Overall profitability and consistency
- Win rate and profit factor
- Position sizing effectiveness
- Trading frequency and timing
- Best and worst performing trades`;
        break;
      case 'psychology':
        prompt += `
- Emotional control in trades
- Decision-making patterns
- Response to wins and losses
- Trading discipline
- Stress management`;
        break;
      case 'pattern':
        prompt += `
- Common trading setups
- Market condition adaptation
- Entry and exit timing
- Recurring trade characteristics
- Strategy effectiveness`;
        break;
      case 'risk':
        prompt += `
- Risk management practices
- Position sizing patterns
- Stop loss usage
- Risk/reward ratios
- Drawdown management`;
        break;
    }

    prompt += `\n\nEnsure your response is in valid JSON format and includes specific, actionable insights.`;

    return prompt;
  }

  private formatTradeForContext(trade: Trade): string {
    const parts = [
      `Date: ${trade.date}`,
      `Time: ${format(parseISO(trade.entry_time), 'HH:mm')} - ${format(parseISO(trade.exit_time), 'HH:mm')}`,
      `Ticker: ${trade.ticker}`,
      `Direction: ${trade.direction}`,
      `Contracts: ${trade.contracts}`,
      `P&L: ${trade.profit_loss}`,
      `Net P&L: ${trade.net_profit}`,
      trade.notes ? `Notes: ${trade.notes}` : null
    ].filter(Boolean);

    return parts.join('\n');
  }
}

// Create a singleton instance
let aiService: AIService | null = null;

export const getAIService = async (userId: string): Promise<AIService> => {
  if (!aiService) {
    aiService = new AIService(userId);
    const success = await aiService.initialize();
    if (!success) {
      throw new Error('Failed to initialize AI service');
    }
  }
  return aiService;
};