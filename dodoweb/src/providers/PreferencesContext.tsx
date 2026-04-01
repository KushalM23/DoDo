import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import type {
  DateFormatPreference,
  TimeFormatPreference,
  UserPreferences,
} from '@/types/preferences';

const PREFERENCES_KEY = '@dodo/preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: true,
  dateFormat: 'eu',
  timeFormat: '12h',
  weekStart: 'monday',
  defaultSnoozeMinutes: 5,
};

type PreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setDateFormat: (format: DateFormatPreference) => Promise<void>;
  setTimeFormat: (format: TimeFormatPreference) => Promise<void>;
  setDefaultSnoozeMinutes: (minutes: number) => Promise<void>;
  resetPreferences: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
);

export function PreferencesProvider({children}: {children: React.ReactNode}) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<UserPreferences>;
        setPreferences(prev => ({
          ...prev,
          ...(typeof parsed.darkMode === 'boolean' ? {darkMode: parsed.darkMode} : {}),
          ...(parsed.dateFormat === 'us' || parsed.dateFormat === 'eu'
            ? {dateFormat: parsed.dateFormat}
            : {}),
          ...(parsed.timeFormat === '12h' || parsed.timeFormat === '24h'
            ? {timeFormat: parsed.timeFormat}
            : {}),
          ...(parsed.weekStart === 'sunday' || parsed.weekStart === 'monday'
            ? {weekStart: parsed.weekStart}
            : {}),
          ...(typeof parsed.defaultSnoozeMinutes === 'number' &&
          Number.isFinite(parsed.defaultSnoozeMinutes)
            ? {
                defaultSnoozeMinutes: Math.max(
                  1,
                  Math.min(1440, Math.round(parsed.defaultSnoozeMinutes)),
                ),
              }
            : {}),
        }));
      } catch {
        // Ignore corrupt preferences and fall back to defaults.
      }
    }
    setLoading(false);
  }, []);

  async function updatePreferences(next: UserPreferences) {
    setPreferences(next);
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      loading,
      async setDarkMode(enabled) {
        await updatePreferences({...preferences, darkMode: enabled});
      },
      async setDateFormat(format) {
        await updatePreferences({...preferences, dateFormat: format});
      },
      async setTimeFormat(format) {
        await updatePreferences({...preferences, timeFormat: format});
      },
      async setDefaultSnoozeMinutes(minutes) {
        const safeMinutes = Math.max(1, Math.min(1440, Math.round(minutes)));
        await updatePreferences({...preferences, defaultSnoozeMinutes: safeMinutes});
      },
      async resetPreferences() {
        await updatePreferences(DEFAULT_PREFERENCES);
      },
    }),
    [loading, preferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}
