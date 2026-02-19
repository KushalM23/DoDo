import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { HabitScreen } from "../screens/habit/HabitScreen";
import { CalendarScreen } from "../screens/calendar/CalendarScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { colors } from "../theme/colors";

export type MainTabsParamList = {
  TasksTab: undefined;
  HabitTab: undefined;
  CalendarTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{label}</Text>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="TasksTab"
        component={TasksScreen}
        options={{
          tabBarLabel: "Tasks",
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon label="✓" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="HabitTab"
        component={HabitScreen}
        options={{
          tabBarLabel: "Habit",
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon label="↻" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{
          tabBarLabel: "Calendar",
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon label="▦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon label="●" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  icon: {
    fontSize: 20,
    color: colors.mutedText,
  },
  iconFocused: {
    color: colors.accent,
  },
});
