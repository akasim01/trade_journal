import { getAIService } from '../lib/ai';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Plus, X } from 'lucide-react';
import { AIMessage, ChatConversation } from '../types';
import { supabase } from '../lib/supabase';
import { EmbeddingsService } from '../lib/embeddings';
import ChatSidebar from './ChatSidebar';

interface AIChatProps {
  userId: string;
  context?: AIMessage['context'];
  className?: string;
}

const AIChat: React.FC<AIChatProps> = ({ userId, context, className = '' }) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAIConfig, setHasAIConfig] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const embeddingsService = useRef<EmbeddingsService | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [embeddingsInitialized, setEmbeddingsInitialized] = useState(false);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      // Delete the message from the database
      const { error } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('id', messageId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message');
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkAIConfig();
      await fetchConversations();
      await initializeEmbeddings();
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeEmbeddings = async () => {
    try {
      if (!embeddingsService.current) {
        embeddingsService.current = new EmbeddingsService(userId);
        const initialized = await embeddingsService.current.initialize();
        if (initialized) {
          await embeddingsService.current.backfillEmbeddings();
          setEmbeddingsInitialized(true);
        }
      }
    } catch (error) {
      console.error('Error initializing embeddings:', error);
      // Don't set error state - embeddings are optional
    }
  };

  const checkAIConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('user_ai_configs')
        .select('api_key')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setHasAIConfig(!!data);
    } catch (error) {
      console.error('Error checking AI config:', error);
      setHasAIConfig(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
      
      if (data && data.length > 0) {
        setSelectedConversationId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('message_order', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleNewChat = async () => {
    setSelectedConversationId(null);
    setMessages([]);
    setNewMessage('');
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      if (selectedConversationId === conversationId) {
        const nextConversation = conversations.find(conv => conv.id !== conversationId);
        setSelectedConversationId(nextConversation?.id || null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const ai = await getAIService(userId);
      
      // Create new conversation if needed
      let conversationId = selectedConversationId;
      if (!conversationId) {
        const { data: newConversation, error: convError } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: userId,
            title: newMessage.slice(0, 50),
            first_message: newMessage
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConversation.id;
        setSelectedConversationId(conversationId);
        setConversations(prev => [newConversation, ...prev]);
      }

      // Get recent conversation history
      const recentMessages = messages.slice(-5).map(msg => ({
        role: 'user' as const,
        content: msg.message,
        response: msg.response
      }));

      // Add conversation history to context
      const enhancedContext = {
        ...context,
        conversation_history: recentMessages
      };

      // Search for relevant trades if embeddings are initialized
      if (embeddingsInitialized && embeddingsService.current) {
        try {
          const dateRange = context?.date_range;
          const similarTrades = await embeddingsService.current.searchSimilarTrades(
            newMessage,
            0.5,
            10,
            dateRange ? {
              start: dateRange.start,
              end: dateRange.end
            } : undefined
          );
          if (similarTrades && similarTrades.length > 0) {
            enhancedContext.trades = similarTrades;
          }
        } catch (error) {
          console.error('Error searching similar trades:', error);
          // Continue without similar trades
        }
      }

      const response = await ai.chat(newMessage, enhancedContext);

      const newMessageObj: AIMessage = {
        id: crypto.randomUUID(),
        user_id: userId,
        conversation_id: conversationId,
        message: newMessage,
        response,
        context: enhancedContext,
        created_at: new Date().toISOString(),
        message_order: messages.length
      };

      setNewMessage('');

      // Save to database
      const { error: saveError } = await supabase
        .from('ai_chat_history')
        .insert([newMessageObj]);

      if (saveError) throw saveError;

      // Update local state
      setMessages(prev => [...prev, newMessageObj]);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    // Auto-adjust height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  if (!hasAIConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Bot className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Assistant Not Configured</h3>
        <p className="text-sm text-gray-600 mb-4">
          To use the AI assistant, please add your OpenAI API key in the settings.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-[500px] bg-white rounded-lg shadow ${className}`}>
      <ChatSidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className="space-y-3"
              onMouseEnter={() => setSelectedMessageId(msg.id)}
              onMouseLeave={() => setSelectedMessageId(null)}
            >
              <div className="flex items-start gap-2 group">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 bg-blue-50 rounded-lg p-2">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.message}</p>
                </div>
                {selectedMessageId === msg.id && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete message"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 bg-purple-50 rounded-lg p-2">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.response}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your trading..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none min-h-[38px] max-h-[120px] py-2 px-3 text-sm"
                disabled={loading}
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIChat;