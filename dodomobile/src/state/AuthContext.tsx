import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, login, register, setAuthSession, setSessionRefreshHandler } from "../services/api";
import type { AuthUser } from "../types/auth";

const AUTH_SESSION_KEY = "@dodo/auth_session";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const savedRaw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
        if (!savedRaw) return;

        const saved = JSON.parse(savedRaw) as StoredAuthSession;
        if (!saved?.token || !saved?.refreshToken) {
          await AsyncStorage.removeItem(AUTH_SESSION_KEY);
          return;
        }

        setAuthSession(saved);
        const me = await fetchMe();
        setToken(saved.token);
        setUser(me);
      } catch {
        setAuthSession(null);
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      } finally {
        setLoading(false);
      }
    }

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    setSessionRefreshHandler(async (session) => {
      if (!session) {
        setAuthSession(null);
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem(AUTH_SESSION_KEY);
        return;
      }

      setAuthSession(session);
      setToken(session.token);
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    });

    return () => {
      setSessionRefreshHandler(null);
    };
  }, []);

  const refreshCurrentUser = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      // Ignore refresh errors and keep existing auth state.
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      refreshUser: refreshCurrentUser,
      async signIn(email: string, password: string) {
        const data = await login(email, password);
        const session: StoredAuthSession = {
          token: data.token,
          refreshToken: data.refreshToken,
        };
        setAuthSession(session);
        setToken(data.token);
        setUser(data.user);
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      },
      async signUp(email: string, password: string, displayName: string) {
        await register(email, password, displayName);
      },
      async signOut() {
        setAuthSession(null);
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      },
    }),
    [loading, refreshCurrentUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
