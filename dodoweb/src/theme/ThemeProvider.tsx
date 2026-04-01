import React, {createContext, useContext, useEffect, useMemo} from 'react';

export type ThemeMode = 'dark' | 'light';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  mutedText: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentLight: string;
  accentGlow: string;
  danger: string;
  dangerLight: string;
  success: string;
  successLight: string;
  highPriority: string;
  mediumPriority: string;
  lowPriority: string;
  habitBadge: string;
  habitBadgeLight: string;
  shadow: string;
  shadowStrong: string;
};

export const darkColors: ThemeColors = {
  background: '#000000',
  surface: '#111111',
  surfaceLight: '#1A1A1A',
  surfaceElevated: '#222222',
  text: '#F5F5F5',
  textSecondary: '#D0D0D0',
  mutedText: '#666666',
  border: '#1E1E1E',
  borderStrong: '#2E2E2E',
  accent: '#E8651A',
  accentLight: 'rgba(232, 101, 26, 0.12)',
  accentGlow: 'rgba(232, 101, 26, 0.20)',
  danger: '#E5484D',
  dangerLight: 'rgba(229, 72, 77, 0.12)',
  success: '#30A46C',
  successLight: 'rgba(48, 164, 108, 0.12)',
  highPriority: '#E5484D',
  mediumPriority: '#F5A623',
  lowPriority: '#30A46C',
  habitBadge: '#8B5CF6',
  habitBadgeLight: 'rgba(139, 92, 246, 0.12)',
  shadow: 'rgba(0, 0, 0, 0.8)',
  shadowStrong: 'rgba(0, 0, 0, 0.95)',
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F7F7F7',
  surfaceLight: '#F0F0F0',
  surfaceElevated: '#EBEBEB',
  text: '#0A0A0A',
  textSecondary: '#1A1A1A',
  mutedText: '#888888',
  border: '#E8E8E8',
  borderStrong: '#D0D0D0',
  accent: '#D85A12',
  accentLight: 'rgba(216, 90, 18, 0.10)',
  accentGlow: 'rgba(216, 90, 18, 0.18)',
  danger: '#B80C00',
  dangerLight: 'rgba(217, 45, 32, 0.10)',
  success: '#13795B',
  successLight: 'rgba(19, 121, 91, 0.10)',
  highPriority: '#D92D20',
  mediumPriority: '#F5A623',
  lowPriority: '#13795B',
  habitBadge: '#6D4BD8',
  habitBadgeLight: 'rgba(109, 75, 216, 0.10)',
  shadow: 'rgba(0, 0, 0, 0.12)',
  shadowStrong: 'rgba(0, 0, 0, 0.25)',
};

const ThemeModeContext = createContext<ThemeMode>('dark');
const ThemeColorsContext = createContext<ThemeColors>(darkColors);

function applyThemeVariables(mode: ThemeMode, colors: ThemeColors) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--surface', colors.surface);
  root.style.setProperty('--surface-light', colors.surfaceLight);
  root.style.setProperty('--surface-elevated', colors.surfaceElevated);
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--muted-text', colors.mutedText);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--border-strong', colors.borderStrong);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-light', colors.accentLight);
  root.style.setProperty('--accent-glow', colors.accentGlow);
  root.style.setProperty('--danger', colors.danger);
  root.style.setProperty('--danger-light', colors.dangerLight);
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--success-light', colors.successLight);
  root.style.setProperty('--high-priority', colors.highPriority);
  root.style.setProperty('--medium-priority', colors.mediumPriority);
  root.style.setProperty('--low-priority', colors.lowPriority);
  root.style.setProperty('--habit-badge', colors.habitBadge);
  root.style.setProperty('--habit-badge-light', colors.habitBadgeLight);
  root.style.setProperty('--shadow', colors.shadow);
  root.style.setProperty('--shadow-strong', colors.shadowStrong);
}

export function ThemeColorsProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => (mode === 'light' ? lightColors : darkColors),
    [mode],
  );

  useEffect(() => {
    applyThemeVariables(mode, value);
  }, [mode, value]);

  return (
    <ThemeModeContext.Provider value={mode}>
      <ThemeColorsContext.Provider value={value}>
        {children}
      </ThemeColorsContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeColorsContext);
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeModeContext);
}

