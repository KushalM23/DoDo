/**
 * ProfileScreen — Object-Based Layout
 *
 * Hero: User Avatar & Name
 * Main Stats: Level, XP, Streak
 * Full Stats: All recovered stats from previous implementation
 */
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../state/AuthContext";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { useCategories } from "../../state/CategoriesContext";
import { AppIcon, type AppIconName } from "../../components/AppIcon";
import { LoadingScreen } from "../../components/LoadingScreen";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/fonts";
import { toLocalDateKey } from "../../utils/dateTime";
import { habitAppliesToDate } from "../../utils/habits";

/* ─── Streak calculation ──────────────────────────────────── */

function calculateStreaks(completedDateKeys: string[]): { currentStreak: number; bestStreak: number } {
  if (completedDateKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const uniqueSorted = [...new Set(completedDateKeys)].sort();
  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00`);
    const cur = new Date(`${uniqueSorted[i]}T00:00:00`);
    const daysDiff = Math.round((cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (daysDiff === 1) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 1;
    }
  }

  const completedSet = new Set(uniqueSorted);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  let probeDate = completedSet.has(todayKey) ? today : completedSet.has(yesterdayKey) ? yesterday : null;
  let currentStreak = 0;
  while (probeDate) {
    const key = toLocalDateKey(probeDate);
    if (!completedSet.has(key)) break;
    currentStreak += 1;
    const next = new Date(probeDate);
    next.setDate(next.getDate() - 1);
    probeDate = next;
  }

  return { currentStreak, bestStreak };
}

/* ─── Stat row component ──────────────────────────────────── */

function StatRow({ label, value, icon, meta }: { label: string; value: string | number; icon: AppIconName; meta?: string }) {
  const colors = useThemeColors();
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 20,
      gap: 20,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        alignItems: "center", justifyContent: "center",
      }}>
        <AppIcon name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 24, fontFamily: fonts.headingSemiBold, color: colors.text, letterSpacing: -0.5 }}>{value}</Text>
    </View>
  );
}

/* ─── Main ─────────────────────────────────────────────────── */
export function ProfileScreen() {
  const colors = useThemeColors();
  const mainStyles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();
  const { tasks, initialized: tInit } = useTasks();
  const { habits, initialized: hInit, loadHistory, completionMap } = useHabits();
  const { categories, initialized: cInit } = useCategories();

  const xpBarAnim = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const xpFade = useRef(new Animated.Value(0)).current;
  const statsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => { void refreshUser(); }, [refreshUser]);
  useEffect(() => {
    void loadHistory({ days: 30 }).catch(() => {});
  }, [loadHistory]);

  // Stagger entrance animations
  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(heroFade, { toValue: 1, damping: 18, stiffness: 100, useNativeDriver: true }),
      Animated.spring(xpFade, { toValue: 1, damping: 18, stiffness: 100, useNativeDriver: true }),
      Animated.spring(statsFade, { toValue: 1, damping: 18, stiffness: 100, useNativeDriver: true }),
    ]).start();
  }, [heroFade, xpFade, statsFade]);

  /* ── Derived stats ── */
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const completedDateKeys = useMemo(
    () => completedTasks.map((t) => toLocalDateKey(t.completedAt ?? t.scheduledAt)),
    [completedTasks],
  );

  const { currentStreak, bestStreak } = useMemo(() => calculateStreaks(completedDateKeys), [completedDateKeys]);

  const totalTasks = tasks.length;
  const totalCompleted = completedTasks.length;
  const completionPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const activeTasks = tasks.filter((t) => !t.completed).length;
  const overdueTasks = tasks.filter((t) => !t.completed && new Date(t.deadline).getTime() < Date.now()).length;
  const onTimeCompletions = completedTasks.filter((t) => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).getTime() <= new Date(t.deadline).getTime();
  }).length;
  const onTimeRate = totalCompleted > 0 ? Math.round((onTimeCompletions / totalCompleted) * 100) : 0;

  const categoryProductivity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of completedTasks) {
      const key = task.categoryId ?? "uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let topKey = "uncategorized";
    let topCount = 0;
    for (const [key, count] of counts.entries()) {
      if (count > topCount) { topKey = key; topCount = count; }
    }
    const categoryName =
      topKey === "uncategorized"
        ? "Uncategorized"
        : categories.find((c) => c.id === topKey)?.name ?? "Unknown";
    return { categoryName, count: topCount };
  }, [categories, completedTasks]);

  const peakWindow = useMemo(() => {
    const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 } as Record<string, number>;
    for (const task of completedTasks) {
      const source = task.completedAt ?? task.scheduledAt;
      const hour = new Date(source).getHours();
      if (hour >= 5 && hour <= 11) buckets.Morning += 1;
      else if (hour >= 12 && hour <= 16) buckets.Afternoon += 1;
      else if (hour >= 17 && hour <= 21) buckets.Evening += 1;
      else buckets.Night += 1;
    }
    let label = "Morning";
    let count = 0;
    for (const [window, windowCount] of Object.entries(buckets)) {
      if (windowCount > count) { label = window; count = windowCount; }
    }
    return { label, count };
  }, [completedTasks]);

  const habitAdherence = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days.push(toLocalDateKey(d));
    }
    let applicable = 0, completed = 0;
    for (const habit of habits) {
      for (const day of days) {
        if (!habitAppliesToDate(habit, day)) continue;
        applicable++;
        if (completionMap[habit.id]?.[day]) completed++;
      }
    }
    const rate = applicable > 0 ? Math.round((completed / applicable) * 100) : 0;
    return { rate, applicable, completed };
  }, [completionMap, habits]);

  const last7DaysCompleted = completedDateKeys.filter((key) => {
    const date = new Date(`${key}T00:00:00`);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays < 7;
  }).length;
  const avgCompletedPerDay = (last7DaysCompleted / 7).toFixed(1);

  const xp = user?.experience_points ?? 0;
  const level = user?.current_level ?? 1;
  const xpIntoLevel = user?.xp_into_level ?? 0;
  const xpForNextLevel = user?.xp_for_next_level ?? 200;
  const levelProgress = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0;
  const displayName = user?.display_name?.trim() || user?.email?.split("@")[0] || "Guest";

  useEffect(() => {
    Animated.spring(xpBarAnim, { toValue: levelProgress, damping: 20, stiffness: 120, useNativeDriver: false }).start();
  }, [levelProgress, xpBarAnim]);

  const xpBarWidth = xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  if (!tInit || !hInit || !cInit) {
    return <LoadingScreen title="Loading profile" />;
  }

  return (
    <SafeAreaView style={mainStyles.container} edges={["top"]}>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── HERO: Avatar + Name ── */}
        <Animated.View style={[mainStyles.heroBlock, { opacity: heroFade, transform: [{ translateY: heroFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          {/* Settings top-right */}
          <Pressable
            style={mainStyles.settingsBtn}
            onPress={() => navigation.navigate("Settings")}
          >
            <AppIcon name="settings" size={20} color={colors.accent} />
          </Pressable>
          <Text style={mainStyles.hugeName} numberOfLines={1} adjustsFontSizeToFit>{displayName}</Text>
        </Animated.View>

        {/* ── Level + XP + Streak ── */}
        <Animated.View style={[mainStyles.xpSection, { opacity: xpFade, transform: [{ translateY: xpFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <View style={mainStyles.levelRow}>
            <Text style={mainStyles.levelNum}>Lv.{level}</Text>
            <View style={mainStyles.streakRow}>
            <AppIcon name="flame" size={24} color={colors.accent} />
            <Text style={mainStyles.streakNum}>{currentStreak} day streak</Text>
          </View>
          </View>

          <View style={mainStyles.xpTrack}>
            <Animated.View style={[mainStyles.xpFill, { width: xpBarWidth }]} />
          </View>
          <View style={mainStyles.xpRow}>
            <Text style={mainStyles.xpVal}>{xpIntoLevel} / {xpForNextLevel} XP</Text>
            <Text style={mainStyles.xpTarget}>to level {level + 1}</Text>
          </View>
        </Animated.View>

        {/* ── Full Stats List ── */}
        <Animated.View style={[mainStyles.statsSection, { opacity: statsFade, transform: [{ translateY: statsFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={mainStyles.statsTitle}>Stats</Text>

          <StatRow label="Tasks completed" value={totalCompleted} icon="check-square" meta="Total tasks marked done" />
          <StatRow label="Completion rate" value={`${completionPct}%`} icon="percent" meta={`${totalCompleted} of ${totalTasks} total`} />
          <StatRow label="Best streak" value={`${bestStreak}d`} icon="flame-kindling" meta="Longest consecutive days" />
          <StatRow label="Active tasks" value={activeTasks} icon="square" meta="Open and not yet completed" />
          <StatRow label="Avg done/day (7d)" value={avgCompletedPerDay} icon="calendar" meta="Last 7-day rolling average" />
          <StatRow label="On-time rate" value={`${onTimeRate}%`} icon="clock" meta={`${onTimeCompletions} completed before deadline`} />
          <StatRow label="Overdue tasks" value={overdueTasks} icon="alert-circle" meta="Open tasks past deadline" />
          <StatRow label="Top category" value={categoryProductivity.count} icon="briefcase" meta={`Most productive: ${categoryProductivity.categoryName}`} />
          <StatRow label="Peak window" value={peakWindow.label} icon="sun" meta={`${peakWindow.count} completions`} />
          <StatRow label="Habits" value={habits.length} icon="repeat" />
          <StatRow label="Habit rate (30d)" value={`${habitAdherence.rate}%`} icon="percent" meta={`${habitAdherence.completed}/${habitAdherence.applicable} check-ins`} />
        </Animated.View>

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    heroBlock: {
      alignItems: "center",
      paddingTop: 24,
      paddingBottom: 24,
      paddingHorizontal: 28,
    },
    settingsBtn: {
      position: "absolute",
      top: 40,
      right: 28,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    hugeName: {
      fontSize: 48,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -1.5,
      textAlign: "center",
    },
    levelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    xpSection: {
      paddingHorizontal: 28,
      paddingTop: 8,
      paddingBottom: 20,
      gap: 10,
    },
    levelNum: {
      fontSize: 28,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -1,
    },
    xpTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceLight,
      overflow: "hidden",
    },
    xpFill: {
      height: "100%",
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    xpRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    xpVal: {
      fontSize: 14,
      fontFamily: fonts.bodyBold,
      color: colors.text,
      letterSpacing: -0.3,
    },
    xpTarget: {
      fontSize: 13,
      fontFamily: fonts.bodySemiBold,
      color: colors.mutedText,
    },
    streakRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
    },
    streakNum: {
      fontSize: 24,
      fontFamily: fonts.bodyBold,
      color: colors.text,
    },
    statsSection: {
      paddingHorizontal: 28,
    },
    statsTitle: {
      fontSize: 44,
      fontFamily: fonts.heading,
      color: colors.accent,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
  });
