import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, login, register, setAuthToken } from "../services/api";
import type { AuthUser } from "../types/auth";

const AUTH_TOKEN_KEY = "@dodo/auth_token";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
        const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (!savedToken) return;

        setAuthToken(savedToken);
        const me = await fetchMe();
        setToken(savedToken);
        setUser(me);
      } catch {
        setAuthToken(null);
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    }

    void bootstrapAuth();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      async signIn(email: string, password: string) {
        const data = await login(email, password);
        setAuthToken(data.token);
        setToken(data.token);
        setUser(data.user);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
      },
      async signUp(email: string, password: string) {
        await register(email, password);
      },
      async signOut() {
        setAuthToken(null);
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      },
    }),
    [loading, token, user],
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
