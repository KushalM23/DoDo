import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchMe,
  login,
  register,
  setAuthSession,
  setSessionRefreshHandler,
} from '@/services/api';
import {purgeUserData} from '@/lib/local/db';
import {runFinalSyncForLogout} from '@/lib/local/syncEngine';
import type {AuthUser} from '@/types/auth';

const AUTH_SESSION_KEY = '@dodo/auth_session';
const AUTH_USER_KEY = '@dodo/auth_user';

type StoredAuthSession = {
  token: string;
  refreshToken: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const savedRaw = localStorage.getItem(AUTH_SESSION_KEY);
        if (!savedRaw) {
          return;
        }

        const saved = JSON.parse(savedRaw) as StoredAuthSession;
        if (!saved?.token || !saved?.refreshToken) {
          localStorage.removeItem(AUTH_SESSION_KEY);
          return;
        }

        setAuthSession(saved);
        setToken(saved.token);

        const cachedUser = localStorage.getItem(AUTH_USER_KEY);
        if (cachedUser) {
          setUser(JSON.parse(cachedUser) as AuthUser);
          setLoading(false);
        }

        try {
          const me = await fetchMe();
          setUser(me);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(me));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (
            message !== 'Invalid or expired token.' &&
            message !== 'You are not logged in.'
          ) {
            console.warn('[AuthContext] Background fetchMe failed:', error);
          }
        }
      } catch {
        setAuthSession(null);
        setToken(null);
        setUser(null);
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      } finally {
        setLoading(false);
      }
    }

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    setSessionRefreshHandler(async session => {
      if (!session) {
        setAuthSession(null);
        setToken(null);
        setUser(null);
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        return;
      }
      setAuthSession(session);
      setToken(session.token);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    });
    return () => {
      setSessionRefreshHandler(null);
    };
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(me));
    } catch {
      // Keep current auth state when a refresh fails.
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      refreshUser: refreshCurrentUser,
      async signIn(email, password) {
        const data = await login(email, password);
        const session: StoredAuthSession = {
          token: data.token,
          refreshToken: data.refreshToken,
        };
        setAuthSession(session);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      },
      async signUp(email, password, displayName) {
        const data = await register(email, password, displayName);
        const session: StoredAuthSession = {
          token: data.token,
          refreshToken: data.refreshToken,
        };
        setAuthSession(session);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      },
      async signOut() {
        if (user?.id) {
          const synced = await runFinalSyncForLogout(user.id);
          if (!synced) {
            throw new Error('Unable to complete final sync. Logout blocked.');
          }
        }

        setAuthSession(null);
        const previousUserId = user?.id;
        setToken(null);
        setUser(null);
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        if (previousUserId) {
          await purgeUserData(previousUserId);
        }
      },
    }),
    [loading, refreshCurrentUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
