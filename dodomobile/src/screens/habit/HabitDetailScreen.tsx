import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { AppIcon } from "../../components/AppIcon";
import { HabitForm } from "../../components/HabitForm";
import { useHabits } from "../../state/HabitsContext";
import { usePreferences } from "../../state/PreferencesContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { colors, fontSize, radii, spacing } from "../../theme/colors";
import { formatHabitFrequency, minuteToLabel } from "../../utils/habits";

type HabitDetailRoute = RouteProp<RootStackParamList, "HabitDetail">;

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitDetailScreen() {
  const route = useRoute<HabitDetailRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { preferences } = usePreferences();
  const { habits, editHabit, removeHabit, loadHistory, isHabitCompletedOn, setHabitCompletedOn } = useHabits();

  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoProgress, setUndoProgress] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const habit = habits.find((h) => h.id === route.params.habitId);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  const weekDays = useMemo(() => {
    const out: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d);
    }
    return out;
  }, [today]);

  useEffect(() => {
    if (!habit) return;
    const start = dateKey(weekDays[0]);
    const end = dateKey(weekDays[weekDays.length - 1]);
    void loadHistory({ habitId: habit.id, startDate: start, endDate: end });
  }, [habit, loadHistory, weekDays]);

  const undoActionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      clearUndoTimers();
    };
  }, []);

  if (!habit) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <AppIcon name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Habit</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Habit not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentHabit = habit;

  const completedToday = isHabitCompletedOn(currentHabit.id, todayKey);

  function clearUndoTimers() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoProgressTimerRef.current) {
      clearInterval(undoProgressTimerRef.current);
      undoProgressTimerRef.current = null;
    }
  }

  function showUndoPopup(habitId: string, date: string) {
    clearUndoTimers();
    setUndoVisible(true);
    setUndoProgress(1);

    const startedAt = Date.now();
    undoProgressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 1 - elapsed / 3000);
      setUndoProgress(remaining);
      if (remaining <= 0 && undoProgressTimerRef.current) {
        clearInterval(undoProgressTimerRef.current);
        undoProgressTimerRef.current = null;
      }
    }, 50);

    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false);
      setUndoProgress(0);
      undoTimerRef.current = null;
    }, 3000);

    const undo = async () => {
      clearUndoTimers();
      setUndoVisible(false);
      setUndoProgress(0);
      try {
        await setHabitCompletedOn(habitId, date, false);
      } catch (err) {
        Alert.alert("Failed to undo habit", err instanceof Error ? err.message : "Unknown error");
      }
    };

    return undo;
  }

  async function toggleTodayCompletion() {
    setBusy(true);
    try {
      const nextCompleted = !completedToday;
      await setHabitCompletedOn(currentHabit.id, todayKey, nextCompleted);
      if (nextCompleted) {
        undoActionRef.current = showUndoPopup(currentHabit.id, todayKey);
      } else {
        clearUndoTimers();
        setUndoVisible(false);
        setUndoProgress(0);
      }
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Unable to update completion.");
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    Alert.alert("Delete Habit", "This will remove the habit and its history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeHabit(currentHabit.id);
            navigation.goBack();
          } catch (err) {
            Alert.alert("Failed", err instanceof Error ? err.message : "Unable to delete habit.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerSide}>
          <AppIcon name="chevron-left" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.name} numberOfLines={1}>{currentHabit.title}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        

        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Text style={styles.streakValue}>{currentHabit.currentStreak}</Text>
            <Text style={styles.streakLabel}>Current streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Text style={styles.streakValue}>{currentHabit.bestStreak}</Text>
            <Text style={styles.streakLabel}>Best streak</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.weekRow}>
          {weekDays.map((day) => {
            const key = dateKey(day);
            const completed = isHabitCompletedOn(currentHabit.id, key);
            const dayLabel = day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
            return (
              <View key={key} style={styles.weekDay}>
                <View style={[styles.weekDot, completed && styles.weekDotDone]}>
                  {completed ? <AppIcon name="check" size={10} color="#fff" /> : null}
                </View>
                <Text style={styles.weekLabel}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Frequency</Text>
            <Text style={styles.infoValue}>{formatHabitFrequency(currentHabit)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{minuteToLabel(currentHabit.timeMinute, preferences.timeFormat)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{currentHabit.durationMinutes ? `${currentHabit.durationMinutes} min` : "-"}</Text>
          </View>
        </View>

        <Pressable style={[styles.completeBtn, busy && styles.disabled]} disabled={busy} onPress={toggleTodayCompletion}>
          <AppIcon name={completedToday ? "rotate-ccw" : "check"} size={16} color="#fff" />
          <Text style={styles.completeBtnText}>{completedToday ? "Undo Today" : "Mark Today Complete"}</Text>
        </Pressable>

        {undoVisible && (
          <View style={styles.undoBar}>
            <View style={styles.undoProgressTrack}>
              <View style={[styles.undoProgressFill, { width: `${Math.max(0, Math.min(1, undoProgress)) * 100}%` }]} />
            </View>
            <Text style={styles.undoText}>Habit completed</Text>
            <Pressable
              onPress={() => {
                void undoActionRef.current?.();
              }}
              hitSlop={10}
            >
              <Text style={styles.undoAction}>Undo</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => setEditVisible(true)}>
            <AppIcon name="edit" size={14} color={colors.accent} />
            <Text style={styles.actionText}>Edit Habit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
            <AppIcon name="trash-2" size={14} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      <HabitForm
        visible={editVisible}
        mode="edit"
        initialValues={currentHabit}
        onCancel={() => setEditVisible(false)}
        onSubmit={(payload) => editHabit(currentHabit.id, payload)}
      />
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
    paddingTop: 12,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerSide: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  placeholder: {
    width: 20,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  streakRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  streakCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  streakValue: {
    color: colors.habitBadge,
    fontSize: 26,
    fontWeight: "800",
  },
  streakLabel: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  weekDay: {
    alignItems: "center",
    gap: spacing.xs,
  },
  weekDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLight,
  },
  weekDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  weekLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  completeBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  completeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
  },
  deleteBtn: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  actionText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: fontSize.md,
  },
  disabled: {
    opacity: 0.5,
  },
  undoBar: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  undoProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: colors.border,
  },
  undoProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  undoText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  undoAction: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
