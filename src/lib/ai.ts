import { AIProvider, AIModel } from '../types';
import { AIService } from './openai';
import { ClaudeService } from './claude';
import { supabase } from './supabase';

// Create a factory function to get the appropriate AI service
export const getAIService = async (userId: string): Promise<AIService | ClaudeService> => {
  try {
    // Get the user's AI configuration
    const { data: config, error } = await supabase
      .from('user_ai_configs')
      .select('provider, api_key, model')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching AI config:', error);
      throw new Error('Failed to fetch AI configuration');
    }

    // If no config exists, default to OpenAI
    if (!config) {
      const openai = new AIService(userId);
      const success = await openai.initialize();
      if (!success) {
        throw new Error('Failed to initialize OpenAI service');
      }
      return openai;
    }

    // Initialize the appropriate service based on provider
    if (config.provider === 'anthropic') {
      const claude = new ClaudeService(userId);
      const success = await claude.initialize();
      if (!success) {
        throw new Error('Failed to initialize Claude service');
      }
      return claude;
    } else {
      const openai = new AIService(userId);
      const success = await openai.initialize();
      if (!success) {
        throw new Error('Failed to initialize OpenAI service');
      }
      return openai;
    }
  } catch (error) {
    console.error('Error getting AI service:', error);
    throw error;
  }
};