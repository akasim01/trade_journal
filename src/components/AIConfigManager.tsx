import React, { useState, useEffect } from 'react';
import { Bot, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AIService } from '../lib/openai';
import { ClaudeService } from '../lib/claude';
import { AIProvider, AIModel } from '../types';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface AIConfigManagerProps {
  userId: string;
}

const MODEL_DESCRIPTIONS: Record<AIModel, string> = {
  'gpt-4o': 'GPT-4 Overflow – advanced text generation with improved context handling',
  'o3-mini': 'o3-mini is the newest small reasoning model, providing high intelligence',
  'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet – latest model with enhanced analytical capabilities'
};

export default function AIConfigManager({ userId }: AIConfigManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [model, setModel] = useState<AIModel>('gpt-4o');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    checkExistingConfig();
  }, []);

  const checkExistingConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('user_ai_configs')
        .select('api_key, provider, model')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      setHasConfig(!!data);
      if (data) {
        setApiKey('****************************************');
        setProvider(data.provider);
        setModel(data.model);
      }
    } catch (error) {
      console.error('Error checking existing config:', error);
    }
  };

  const validateApiKey = async (key: string): Promise<boolean> => {
    setValidating(true);
    setError(null);

    try {
      // Basic format validation
      if (!key.startsWith(provider === 'openai' ? 'sk-' : 'sk-')) {
        setError(`Invalid API key format. ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API keys should start with "sk-"`);
        return false;
      }

      if (key.length < 40) {
        setError('Invalid API key length. Please check your key.');
        return false;
      }

      let isValid = false;
      if (provider === 'openai') {
        const ai = new AIService(userId);
        isValid = await ai.validateApiKey(key);
      } else {
        const claude = new ClaudeService(userId);
        isValid = await claude.validateApiKey(key);
      }
      
      if (!isValid) {
        setError('Invalid API key. Please check your key and try again.');
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error validating API key:', error);
      
      if (error.message?.includes('401')) {
        setError('Invalid API key. Please check your key and try again.');
      } else if (error.message?.includes('429')) {
        setError('Too many requests. Please try again in a few minutes.');
      } else {
        setError('Failed to validate API key. Please try again.');
      }
      
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const key = apiKey.trim();
      if (!key) {
        setError('Please enter an API key');
        return;
      }

      // Skip validation if the key is masked (unchanged)
      if (!key.startsWith('*')) {
        const isValid = await validateApiKey(key);
        if (!isValid) {
          setLoading(false);
          return;
        }

        const { error: upsertError } = await supabase
          .from('user_ai_configs')
          .upsert({
            user_id: userId,
            provider,
            api_key: key,
            model,
            updated_at: new Date().toISOString()
          });

        if (upsertError) throw upsertError;

        setSuccess('API configuration saved successfully');
        setHasConfig(true);
        setApiKey('****************************************');
      } else {
        // Only update the provider and model if the API key hasn't changed
        const { error: updateError } = await supabase
          .from('user_ai_configs')
          .update({
            provider,
            model,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) throw updateError;

        setSuccess('AI configuration updated successfully');
      }
    } catch (error: any) {
      console.error('Error saving API configuration:', error);
      
      if (error.message?.includes('duplicate')) {
        setError('This API key is already in use');
      } else {
        setError('Failed to save configuration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('user_ai_configs')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setApiKey('');
      setProvider('openai');
      setModel('gpt-4o');
      setHasConfig(false);
      setSuccess('AI configuration removed successfully');
    } catch (error) {
      console.error('Error deleting AI configuration:', error);
      setError('Failed to remove configuration');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => {
              const newProvider = e.target.value as AIProvider;
              setProvider(newProvider);
              setModel(newProvider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-latest');
            }}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="block w-full pr-10 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5"
              placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 px-3 flex items-center"
            >
              {showApiKey ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your API key will be encrypted and stored securely. You can find your API key in your{' '}
            <a 
              href={provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://console.anthropic.com/account/keys'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              {provider === 'openai' ? 'OpenAI' : 'Anthropic'} account settings
            </a>.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model Selection
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AIModel)}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {provider === 'openai' ? (
              <optgroup label="OpenAI Models">
                <option value="gpt-4o">gpt-4o</option>
                <option value="o3-mini">o3-mini</option>
              </optgroup>
            ) : (
              <optgroup label="Claude Models">
                <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
              </optgroup>
            )}
          </select>
          <div className="mt-2 text-sm">
            <p className="font-medium text-gray-700">Model Description:</p>
            <p className="text-gray-600">{MODEL_DESCRIPTIONS[model]}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="submit"
            disabled={loading || validating}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading || validating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                {validating ? 'Validating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Bot className="h-5 w-5 mr-2" />
                {hasConfig ? 'Update Configuration' : 'Save Configuration'}
              </>
            )}
          </button>

          {hasConfig && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 mr-2" />
              Remove Configuration
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {showDeleteConfirm && (
        <DeleteConfirmationDialog
          title="Remove AI Configuration"
          message="Are you sure you want to remove your AI configuration? This will disable all AI features."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}