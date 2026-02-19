import React from "react";
import { StatusBar } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/state/AuthContext";
import { TasksProvider } from "./src/state/TasksContext";
import { CategoriesProvider } from "./src/state/CategoriesContext";
import { HabitsProvider } from "./src/state/HabitsContext";
import { colors } from "./src/theme/colors";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    text: colors.text,
    primary: colors.accent,
    card: colors.surface,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
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
    </SafeAreaProvider>
  );
}

