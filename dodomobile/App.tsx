import React, { useMemo } from "react";
import { StatusBar } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/state/AuthContext";
import { TasksProvider } from "./src/state/TasksContext";
import { CategoriesProvider } from "./src/state/CategoriesContext";
import { HabitsProvider } from "./src/state/HabitsContext";
import { PreferencesProvider, usePreferences } from "./src/state/PreferencesContext";
import { ThemeColorsProvider, useThemeColors, useThemeMode } from "./src/theme/ThemeProvider";
import { AlertProvider } from "./src/state/AlertContext";

function AppNavigation() {
  const colors = useThemeColors();
  const mode = useThemeMode();

  const navTheme = useMemo(() => {
    const base = mode === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        text: colors.text,
        primary: colors.accent,
        card: colors.surface,
        border: colors.border,
      },
    };
  }, [colors, mode]);

  return (
    <>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <AuthProvider>
        <CategoriesProvider>
          <HabitsProvider>
            <TasksProvider>
              <NavigationContainer theme={navTheme}>
                <RootNavigator />
              </NavigationContainer>
            </TasksProvider>
          </HabitsProvider>
        </CategoriesProvider>
      </AuthProvider>
    </>
  );
}

function AppShell() {
  const { preferences } = usePreferences();
  const mode = preferences.darkMode ? "dark" : "light";

  return (
    <ThemeColorsProvider mode={mode}>
      <AlertProvider>
        <AppNavigation />
      </AlertProvider>
    </ThemeColorsProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AppShell />
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

