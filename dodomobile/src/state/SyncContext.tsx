import React, {createContext, useContext, useEffect, useMemo, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {initializeLocalDb} from '../lib/local/db';
import {runSync} from '../lib/local/syncEngine';
import {useAuth} from './AuthContext';

type SyncContextValue = {
  runManualSync: () => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void initializeLocalDb();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void runSync(user.id, 'startup');

    const interval = setInterval(() => {
      void runSync(user.id, 'periodic');
    }, 5 * 60 * 1000);

    const sub = AppState.addEventListener('change', nextState => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        void runSync(user.id, 'foreground');
      }

      if (nextState.match(/inactive|background/)) {
        void runSync(user.id, 'manual');
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
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

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used inside SyncProvider');
  }
  return context;
}
