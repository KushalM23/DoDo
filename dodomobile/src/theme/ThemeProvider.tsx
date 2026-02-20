import React, { createContext, useContext, useMemo } from "react";

type ThemeMode = "dark" | "light";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceLight: string;
  text: string;
  textSecondary: string;
  mutedText: string;
  border: string;
  accent: string;
  accentLight: string;
  danger: string;
  dangerLight: string;
  success: string;
  successLight: string;
  highPriority: string;
  mediumPriority: string;
  lowPriority: string;
  habitBadge: string;
  habitBadgeLight: string;
};

const darkColors: ThemeColors = {
  background: "#0D0D0D",
  surface: "#1A1A1A",
  surfaceLight: "#252525",
  text: "#F5F5F5",
  textSecondary: "#E0E0E0",
  mutedText: "#888888",
  border: "#2A2A2A",
  accent: "#E8651A",
  accentLight: "rgba(232, 101, 26, 0.15)",
  danger: "#E5484D",
  dangerLight: "rgba(229, 72, 77, 0.15)",
  success: "#30A46C",
  successLight: "rgba(48, 164, 108, 0.15)",
  highPriority: "#E5484D",
  mediumPriority: "#F5A623",
  lowPriority: "#30A46C",
  habitBadge: "#8B5CF6",
  habitBadgeLight: "rgba(139, 92, 246, 0.15)",
};

const lightColors: ThemeColors = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceLight: "#F0F2F5",
  text: "#111827",
  textSecondary: "#374151",
  mutedText: "#6B7280",
  border: "#D1D5DB",
  accent: "#D85A12",
  accentLight: "rgba(216, 90, 18, 0.14)",
  danger: "#D92D20",
  dangerLight: "rgba(217, 45, 32, 0.12)",
  success: "#13795B",
  successLight: "rgba(19, 121, 91, 0.12)",
  highPriority: "#D92D20",
  mediumPriority: "#C97A1F",
  lowPriority: "#13795B",
  habitBadge: "#6D4BD8",
  habitBadgeLight: "rgba(109, 75, 216, 0.14)",
};

const ThemeModeContext = createContext<ThemeMode>("dark");
const ThemeColorsContext = createContext<ThemeColors>(darkColors);

export function ThemeColorsProvider({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  const value = useMemo(() => (mode === "light" ? lightColors : darkColors), [mode]);

  return (
    <ThemeModeContext.Provider value={mode}>
      <ThemeColorsContext.Provider value={value}>{children}</ThemeColorsContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeColorsContext);
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeModeContext);
}
