import { createClient } from '@supabase/supabase-js';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: localStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'trading-journal@1.0.0'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  fetchOptions: {
    retries: 3,
    retryDelay: 1000, // 1 second initial delay
    retryCondition: (error: any) => {
      // Retry on network errors and 5xx server errors
      return error.message === 'Failed to fetch' || 
             (error.status && error.status >= 500 && error.status < 600);
    }
  }
});

export const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Don't retry on client errors (4xx) or if no retries left
    if (retries === 0 || (error.status && error.status < 500)) {
      throw error;
    }

    // Wait before retrying, with exponential backoff
    await sleep(delay);

    // Retry with one less retry remaining and doubled delay
    return withRetry(operation, retries - 1, delay * 2);
  }
};

// Add auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    localStorage.removeItem('supabase.auth.token');
    window.location.href = '/login';
  }
});

// Add realtime subscription for user deletions
supabase.channel('public:usernames')
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'usernames'
  }, async (payload) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === payload.old.id) {
        await supabase.auth.signOut();
        window.location.href = '/login?reason=deleted';
      }
    } catch (error) {
      console.error('Error handling user deletion:', error);
      window.location.href = '/login?reason=error';
    }
  })
  .subscribe();
