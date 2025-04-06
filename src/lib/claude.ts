import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';
import { ClaudeModel } from '../types';
import { format, parseISO } from 'date-fns';
import { Trade, AIInsight } from '../types';
import { EmbeddingsService } from './embeddings';

export class ClaudeService {
  private client: Anthropic | null = null;
  private userId: string;
  private model: ClaudeModel = 'claude-3-5-sonnet-20240620';
  private retryDelay = 1000;
  private maxRetries = 3;
  private embeddingsService: EmbeddingsService;

  constructor(userId: string) {
    this.userId = userId;
    this.embeddingsService = new EmbeddingsService(userId);
  }

  async initialize(): Promise<boolean> {
    try {
      const { data: config, error } = await supabase
        .from('user_ai_configs')
        .select('api_key, model')
        .eq('user_id', this.userId)
        .eq('provider', 'anthropic')
        .maybeSingle();

      if (error) {
        console.error('Error initializing Claude service:', error);
        return false;
      }

      if (!config?.api_key) {
        return false;
      }

      this.client = new Anthropic({
        apiKey: config.api_key,
        // baseURL: 'https://api.anthropic.com/v1'
        baseURL: 'https://api.anthropic.com/v1'
      });

      if (config.model) {
        this.model = config.model as ClaudeModel;
      }

      // Initialize embeddings service
      await this.embeddingsService.initialize();

      return true;
    } catch (error) {
      console.error('Error initializing Claude service:', error);
      return false;
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid API key format. Anthropic API keys must start with "sk-ant-"');
    }

    try {
      const testClient = new Anthropic({
        apiKey,
        baseURL: 'https://api.anthropic.com/v1/'
      });

      // Test the API key by making a simple request
      const response = await testClient.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
        system: 'You are a helpful AI assistant.'
      }).catch((error) => {
        // Handle API-specific errors
        if (error.status === 401) {
          throw new Error('Invalid API key');
        }
        if (error.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few minutes.');
        }
        if (error.message?.includes('quota')) {
          throw new Error('API key has insufficient quota');
        }
        // Re-throw unknown errors
        throw error;
      });

      return !!response?.id;
    } catch (error: any) {
      // Log the full error for debugging
      console.error('Error validating Anthropic API key:', {
        error,
        message: error.message,
        status: error.status,
        response: error.response
      });

      // Throw a user-friendly error message
      if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Failed to validate API key. Please try again.');
      }
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries,
    delay = this.retryDelay
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries === 0) throw error;

      // Handle rate limiting
      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        const waitTime = error?.headers?.['retry-after'] || 1;
        await this.sleep(waitTime * 1000);
        return this.retryWithBackoff(operation, retries - 1, delay);
      }

      // For other errors, use exponential backoff
      await this.sleep(delay);
      return this.retryWithBackoff(operation, retries - 1, delay * 2);
    }
  }

  async chat(message: string, context: any): Promise<string> {
    if (!this.client) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize Claude service');
      }
    }

    const operation = async () => {
      // Search for relevant trades using embeddings
      let relevantTrades: Trade[] = [];
      try {
        relevantTrades = await this.embeddingsService.searchSimilarTrades(message, 0.5, 5);
      } catch (error) {
        console.error('Error searching similar trades:', error);
        // Continue without similar trades
      }

      // Enhance context with relevant trades
      const enhancedContext = {
        ...context,
        relevant_trades: relevantTrades.map(trade => ({
          date: trade.date,
          ticker: trade.ticker,
          direction: trade.direction,
          profit_loss: trade.profit_loss,
          net_profit: trade.net_profit,
          notes: trade.notes
        }))
      };

      const systemPrompt = `You are an expert AI trading assistant with deep knowledge of trading psychology, technical analysis, and risk management. Your role is to help traders improve their performance by providing data-driven insights and psychological support.

Keep your responses clear, concise, and well-formatted. Focus on providing specific, actionable advice based on the available data.

${relevantTrades.length > 0 ? `I've found ${relevantTrades.length} similar trades that might be relevant to your question. I'll consider these when providing my response.` : ''}

Current context: ${JSON.stringify(enhancedContext)}

IMPORTANT INSTRUCTIONS:
1. Provide your response in clear, natural language
2. Use proper paragraphs and formatting for readability
3. Do not include any JSON or structured data formats
4. Do not include any system messages or metadata
5. Start your response directly with the relevant content
6. Be concise and to the point`;

      const response = await this.client!.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: message }
        ],
        system: systemPrompt
      });

      let aiResponse = response.content[0].text;

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
      console.error('Error in Claude chat:', error);
      throw new Error('Failed to generate response. Please try again.');
    }
  }

  async generateInsights(trades: Trade[], type: AIInsight['type']): Promise<AIInsight> {
    if (!this.client) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize Claude service');
      }
    }

    const operation = async () => {
      const systemPrompt = this.buildInsightPrompt(type, trades);
      
      const response = await this.client!.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: 'Generate insights based on the trading data provided.' }
        ],
        system: systemPrompt
      });

      const responseText = response.content[0].text;
      let content;

      try {
        content = JSON.parse(responseText);
        
        // Validate content structure
        if (!content.title || !content.description || !content.metrics || !content.recommendations) {
          throw new Error('Invalid response format');
        }
      } catch (e) {
        console.error('Error parsing Claude response:', e);
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

Your response should be in this exact JSON format:
{
  "title": "Brief, specific title about the ${type} analysis",
  "description": "Detailed analysis of the findings",
  "metrics": {
    "strengths": ["List key strengths identified"],
    "weaknesses": ["List areas needing improvement"],
    "patterns": ["List identified patterns"],
    "concerns": ["List risk management concerns"],
    "positives": ["List positive aspects"],
    "effective": ["List effective strategies"]
  },
  "recommendations": ["List of specific, actionable recommendations"]
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