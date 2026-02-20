import React, { useMemo } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../state/AuthContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { TaskDetailScreen } from "../screens/tasks/TaskDetailScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { HabitDetailScreen } from "../screens/habit/HabitDetailScreen";
import { MainTabs } from "./MainTabs";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  TaskDetail: { taskId: string };
  HabitDetail: { habitId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
          <Stack.Screen name="HabitDetail" component={HabitDetailScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Welcome Back" }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create Account" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});

