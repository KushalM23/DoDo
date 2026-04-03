import React, {createContext, useEffect, useMemo, useRef} from 'react';
import {initializeLocalDb} from '@/lib/local/db';
import {runSync} from '@/lib/local/syncEngine';
import {getSupabaseRealtimeClient} from '@/lib/realtime/supabaseBrowser';
import {useAuth} from './AuthContext';

type SyncContextValue = {
  runManualSync: () => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | undefined>(undefined);
const REALTIME_TABLES = ['tasks', 'categories', 'habits', 'notes', 'habit_completions'] as const;

export function SyncProvider({children}: {children: React.ReactNode}) {
  const {token, user} = useAuth();
  const realtimeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void initializeLocalDb();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void runSync(user.id, 'startup');

    const interval = window.setInterval(() => {
      void runSync(user.id, 'periodic');
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSync(user.id, 'foreground');
      } else {
        void runSync(user.id, 'manual');
      }
    };

    const handleOnline = () => {
      void runSync(user.id, 'foreground');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !token) {
      return;
    }

    const supabase = getSupabaseRealtimeClient();
    if (!supabase) {
      return;
    }

    let cancelled = false;
    const scheduleRealtimeSync = () => {
      if (realtimeTimerRef.current != null) {
        window.clearTimeout(realtimeTimerRef.current);
      }

      realtimeTimerRef.current = window.setTimeout(() => {
        realtimeTimerRef.current = null;
        void runSync(user.id, 'foreground');
      }, 120);
    };

    void supabase.realtime.setAuth(token);

    const channel = REALTIME_TABLES.reduce(
      (currentChannel, table) =>
        currentChannel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (!cancelled) {
              scheduleRealtimeSync();
            }
          },
        ),
      supabase.channel(`dodo-sync-${user.id}`),
    );

    channel.subscribe();

    return () => {
      cancelled = true;
      if (realtimeTimerRef.current != null) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [token, user?.id]);

  const value = useMemo<SyncContextValue>(
    () => ({
      runManualSync: async () => {
        if (!user?.id) {
          return false;
        }
        return runSync(user.id, 'manual');
      },
    }),
    [user?.id],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
