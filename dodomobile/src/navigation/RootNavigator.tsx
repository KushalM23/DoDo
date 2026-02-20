import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../state/AuthContext";
import { useTasks } from "../state/TasksContext";
import { useHabits } from "../state/HabitsContext";
import { useCategories } from "../state/CategoriesContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { TaskDetailScreen } from "../screens/tasks/TaskDetailScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { HabitDetailScreen } from "../screens/habit/HabitDetailScreen";
import { MainTabs } from "./MainTabs";
import { LoadingScreen } from "../components/LoadingScreen";

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
  const { user, loading: authLoading } = useAuth();
  const { initialized: tasksInitialized } = useTasks();
  const { initialized: habitsInitialized } = useHabits();
  const { initialized: categoriesInitialized } = useCategories();

  const startupLoading =
    authLoading ||
    (Boolean(user) && (!tasksInitialized || !habitsInitialized || !categoriesInitialized));

  if (startupLoading) {
    return <LoadingScreen variant="app" title="Dodo" />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: "fade" }} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="HabitDetail" component={HabitDetailScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: "slide_from_left" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Welcome Back", animation: "fade" }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create Account", animation: "slide_from_right" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

