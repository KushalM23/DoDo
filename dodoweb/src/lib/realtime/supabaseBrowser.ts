import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {env} from '@/config/env';

declare global {
  var __dodoSupabaseRealtimeClient: SupabaseClient | undefined;
}

export function getSupabaseRealtimeClient(): SupabaseClient | null {
  if (typeof window === 'undefined' || !env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  if (!globalThis.__dodoSupabaseRealtimeClient) {
    globalThis.__dodoSupabaseRealtimeClient = createClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  return globalThis.__dodoSupabaseRealtimeClient;
}
