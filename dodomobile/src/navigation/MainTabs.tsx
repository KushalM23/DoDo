import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  type LayoutChangeEvent,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { HabitScreen } from "../screens/habit/HabitScreen";
import { CalendarScreen } from "../screens/calendar/CalendarScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { fontSize } from "../theme/colors";
import { fonts } from "../theme/fonts";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";
import { AppIcon, type AppIconName } from "../components/AppIcon";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MainTabsParamList = {
  TasksTab: undefined;
  HabitTab: undefined;
  CalendarTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

type TabItem = {
  key: string;
  label: string;
  icon: AppIconName;
};

const TAB_ITEMS: TabItem[] = [
  { key: "TasksTab", label: "Tasks", icon: "check-square" },
  { key: "HabitTab", label: "Habits", icon: "repeat" },
  { key: "CalendarTab", label: "Calendar", icon: "calendar" },
  { key: "ProfileTab", label: "Profile", icon: "user" },
];

const BAR_PADDING = 7;

const LAYOUT_ANIM_CONFIG = {
  duration: 350,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleXY,
  },
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
    duration: 250,
  },
  delete: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
    duration: 150,
  },
};

/* ─── Custom Tab Bar ──────────────────────────────────────── */
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Pill position & width animated values
  const pillLeft = useRef(new Animated.Value(BAR_PADDING)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;

  // Store measured tab layouts
  const tabLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const hasInit = useRef(false);

  const slidePillTo = useCallback(
    (index: number) => {
      const m = tabLayouts.current[index];
      if (!m) return;

      // First layout → snap immediately, no animation
      if (!hasInit.current) {
        pillLeft.setValue(m.x);
        pillWidth.setValue(m.width);
        hasInit.current = true;
        return;
      }

      Animated.parallel([
        Animated.spring(pillLeft, {
          toValue: m.x,
          useNativeDriver: false,
          tension: 70,
          friction: 11,
        }),
        Animated.spring(pillWidth, {
          toValue: m.width,
          useNativeDriver: false,
          tension: 70,
          friction: 11,
        }),
      ]).start();
    },
    [pillLeft, pillWidth],
  );

  const onTabLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      tabLayouts.current[index] = { x, width };

      // When the active tab reports its layout, animate pill to it
      if (index === state.index) {
        slidePillTo(index);
      }
    },
    [state.index, slidePillTo],
  );

  // Trigger LayoutAnimation when switching tabs so label mount/unmount is smooth
  useEffect(() => {
    LayoutAnimation.configureNext(LAYOUT_ANIM_CONFIG);
  }, [state.index]);

  return (
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {/* Shadow wrapper for extra depth on iOS */}
      <View style={[styles.shadowWrap, { shadowColor: colors.shadow }]}>
        <View
          style={[styles.tabBarContainer, { backgroundColor: colors.surface }]}
        >
          {/* ── Sliding pill background ── */}
          <Animated.View
            style={[
              styles.slidingPill,
              {
                backgroundColor: colors.accent,
                left: pillLeft,
                width: pillWidth,
              },
            ]}
          />

          {/* ── Tab buttons ── */}
          {state.routes.map((route, index) => {
            const item = TAB_ITEMS[index];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.7}
                style={[
                  styles.tabButton,
                  !isFocused && styles.tabButtonInactive,
                ]}
                onLayout={(e) => onTabLayout(index, e)}
              >
                <AppIcon
                  name={item.icon}
                  size={22}
                  color={isFocused ? colors.text : colors.mutedText}
                />
                {isFocused && (
                  <Text
                    style={[
                      styles.label,
                      { color: colors.text, fontSize: fontSize.sm },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ─── Main Tabs Navigator ─────────────────────────────────── */
export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="TasksTab" component={TasksScreen} />
      <Tab.Screen name="HabitTab" component={HabitScreen} />
      <Tab.Screen name="CalendarTab" component={CalendarScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */
const styles = StyleSheet.create({
  tabBarOuter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 8,
  },
  shadowWrap: {
    marginHorizontal: 20,
    borderRadius: 40,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 30,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  tabBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    paddingVertical: BAR_PADDING,
    paddingHorizontal: BAR_PADDING,
    overflow: "hidden",
  },
  slidingPill: {
    position: "absolute",
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    borderRadius: 32,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    zIndex: 1,
  },
  tabButtonInactive: {
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: fonts.bodyBold,
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
