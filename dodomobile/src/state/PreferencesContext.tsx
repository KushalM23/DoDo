import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DateFormatPreference = "us" | "eu";
export type TimeFormatPreference = "12h" | "24h";
export type WeekStartPreference = "sunday" | "monday";

export type UserPreferences = {
  darkMode: boolean;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  weekStart: WeekStartPreference;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: true,
  dateFormat: "eu",
  timeFormat: "12h",
  weekStart: "monday",
};

const PREFERENCES_KEY = "@dodo/preferences";

type PreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setDateFormat: (format: DateFormatPreference) => Promise<void>;
  setTimeFormat: (format: TimeFormatPreference) => Promise<void>;
  setWeekStart: (weekStart: WeekStartPreference) => Promise<void>;
  resetPreferences: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as Partial<UserPreferences>;
        setPreferences((prev) => ({
          ...prev,
          ...(typeof parsed.darkMode === "boolean" ? { darkMode: parsed.darkMode } : {}),
          ...(parsed.dateFormat === "us" || parsed.dateFormat === "eu" ? { dateFormat: parsed.dateFormat } : {}),
          ...(parsed.timeFormat === "12h" || parsed.timeFormat === "24h" ? { timeFormat: parsed.timeFormat } : {}),
          ...(parsed.weekStart === "sunday" || parsed.weekStart === "monday" ? { weekStart: parsed.weekStart } : {}),
        }));
      } finally {
        setLoading(false);
      }
    }

    void loadPreferences();
  }, []);

  async function updatePreferences(next: UserPreferences) {
    setPreferences(next);
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      loading,
      async setDarkMode(enabled: boolean) {
        await updatePreferences({ ...preferences, darkMode: enabled });
      },
      async setDateFormat(format: DateFormatPreference) {
        await updatePreferences({ ...preferences, dateFormat: format });
      },
      async setTimeFormat(format: TimeFormatPreference) {
        await updatePreferences({ ...preferences, timeFormat: format });
      },
      async setWeekStart(weekStart: WeekStartPreference) {
        await updatePreferences({ ...preferences, weekStart });
      },
      async resetPreferences() {
        await updatePreferences(DEFAULT_PREFERENCES);
      },
    }),
    [loading, preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return ctx;
}
