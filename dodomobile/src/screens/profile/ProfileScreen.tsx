import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../state/AuthContext";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { usePreferences } from "../../state/PreferencesContext";
import { colors, spacing, radii, fontSize } from "../../theme/colors";
import { AppIcon } from "../../components/AppIcon";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { formatDate, toLocalDateKey } from "../../utils/dateTime";

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

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const { preferences } = usePreferences();

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
  const last7DaysCompleted = completedDateKeys.filter((key) => {
    const date = new Date(`${key}T00:00:00`);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays < 7;
  }).length;
  const avgCompletedPerDay = (last7DaysCompleted / 7).toFixed(1);

  const xp = totalCompleted * 20 + bestStreak * 30 + habits.length * 10;
  const level = Math.floor(xp / 200) + 1;
  const levelProgress = (xp % 200) / 200;
  const xpToNextLevel = 200 - (xp % 200 || 200);
  const displayName = user?.display_name?.trim() || user?.email?.split("@")[0] || "Guest";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase() ?? "?"}</Text>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.email}>{user?.email ?? "Not signed in"}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.streakRow}>
            <View>
              <Text style={styles.progressLabel}>Current streak</Text>
              <Text style={styles.progressValue}>{currentStreak} day{currentStreak === 1 ? "" : "s"}</Text>
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>LVL {level}</Text>
            </View>
          </View>

          <View style={styles.xpHeader}>
            <Text style={styles.xpText}>{xp} XP total</Text>
            <Text style={styles.xpHint}>{xpToNextLevel} XP to next level</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.max(4, levelProgress * 100)}%` }]} />
          </View>
        </View>

        <Pressable style={styles.settingsBtn} onPress={() => navigation.navigate("Settings")}> 
          <AppIcon name="settings" size={16} color={colors.text} />
          <Text style={styles.settingsText}>Settings</Text>
          <AppIcon name="chevron-right" size={16} color={colors.mutedText} />
        </Pressable>

        <Text style={styles.sectionTitle}>Stats</Text>

        <View style={styles.statsStack}>
          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="check-square" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Tasks completed</Text>
            </View>
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statMeta}>Total tasks marked done</Text>
          </View>

          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="percent" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Completion percentage</Text>
            </View>
            <Text style={styles.statValue}>{completionPct}%</Text>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${Math.max(2, completionPct)}%` }]} />
            </View>
          </View>

          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="flame" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Current streak</Text>
            </View>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statMeta}>Active streak right now</Text>
          </View>

          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="flame-kindling" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Best streak</Text>
            </View>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statMeta}>Longest run of consecutive days</Text>
          </View>

          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="square" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Active tasks</Text>
            </View>
            <Text style={styles.statValue}>{activeTasks}</Text>
            <Text style={styles.statMeta}>Open and not yet completed</Text>
          </View>

          <View style={styles.statSpotlight}>
            <View style={styles.statHeadingRow}>
              <View style={styles.statIconWrap}>
                <AppIcon name="calendar" size={15} color={colors.accent} />
              </View>
              <Text style={styles.statLabel}>Avg done/day (7d)</Text>
            </View>
            <Text style={styles.statValue}>{avgCompletedPerDay}</Text>
            <Text style={styles.statMeta}>Last 7-day rolling average</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.sm,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.accent,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.lg,
  },
  profileRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.accent,
  },
  profileMeta: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  displayName: {
    fontSize: fontSize.xl,
    color: colors.text,
    fontWeight: "700",
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginTop: spacing.xs,
  },
  progressSection: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  progressValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  xpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  xpText: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
  xpTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  xpHint: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
  },
  levelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  levelText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  settingsBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingsText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: fontSize.md,
    flex: 1,
    marginLeft: spacing.sm,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
  },
  statsStack: {
    width: "100%",
    gap: spacing.md,
  },
  statSpotlight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 118,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.xxl + 6,
    fontWeight: "700",
    marginTop: spacing.md,
    lineHeight: fontSize.xxl + 12,
  },
  statMeta: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  meterTrack: {
    height: 8,
    marginTop: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
});
