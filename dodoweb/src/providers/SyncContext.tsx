import React, {createContext, useEffect, useMemo} from 'react';
import {initializeLocalDb} from '@/lib/local/db';
import {runSync} from '@/lib/local/syncEngine';
import {useAuth} from './AuthContext';

type SyncContextValue = {
  runManualSync: () => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();

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

