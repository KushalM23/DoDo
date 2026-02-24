import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HabitForm } from "../../components/HabitForm";
import { AppIcon } from "../../components/AppIcon";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useHabits } from "../../state/HabitsContext";
import { useAlert } from "../../state/AlertContext";
import { usePreferences } from "../../state/PreferencesContext";
import type { Habit } from "../../types/habit";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { fontSize, radii, spacing } from "../../theme/colors";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";
import { formatHabitFrequency, minuteToLabel } from "../../utils/habits";

export function HabitScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { habits, addHabit, removeHabit, loading, initialized } = useHabits();
  const { showAlert } = useAlert();
  const { preferences } = usePreferences();
  const [formVisible, setFormVisible] = useState(false);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => a.title.localeCompare(b.title));
  }, [habits]);

  if (!initialized || (loading && habits.length === 0)) {
    return <LoadingScreen title="Loading habits" />;
  }

  function openHabit(habit: Habit) {
    if (selectionMode) {
      toggleSelect(habit.id);
      return;
    }
    navigation.navigate("HabitDetail", { habitId: habit.id });
  }

  function handleLongPress(habit: Habit) {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([habit.id]));
    } else {
      toggleSelect(habit.id);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    showAlert(
      `Delete ${selectedIds.size} habit${selectedIds.size > 1 ? "s" : ""}?`,
      "This will remove the selected habits and their history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of selectedIds) {
              try {
                await removeHabit(id);
              } catch {
                // Continue deleting others even if one fails
              }
            }
            exitSelectionMode();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <Pressable style={styles.selectionCancelBtn} onPress={exitSelectionMode}>
            <AppIcon name="x" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          <Pressable
            style={styles.selectionSelectAll}
            onPress={() => {
              const allIds = new Set(sortedHabits.map((h) => h.id));
              setSelectedIds(allIds);
            }}
          >
            <Text style={styles.selectionSelectAllText}>All</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Habits</Text>
            <Text style={styles.headerSub}>One day at a time</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{sortedHabits.length}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={sortedHabits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        key={selectionMode ? "selection" : "normal"}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={sortedHabits.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <Pressable
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => openHabit(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={400}
            >
              {selectionMode && (
                <View style={[styles.selectionDot, isSelected && styles.selectionDotActive]}>
                  {isSelected && <AppIcon name="check" size={10} color="#fff" />}
                </View>
              )}
              <View style={styles.iconPill}>
                <AppIcon name={item.icon} size={14} color={colors.habitBadge} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.cardMetaRow}>
                <AppIcon name="repeat" size={12} color={colors.mutedText} />
                <Text style={styles.cardMetaText} numberOfLines={1}>{formatHabitFrequency(item)}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <AppIcon name="clock" size={12} color={colors.mutedText} />
                <Text style={styles.cardMetaText}>{minuteToLabel(item.timeMinute, preferences.timeFormat)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <AppIcon name="repeat" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Create a recurring habit to start building streaks.</Text>
          </View>
        }
      />

      {/* Bulk delete bar (selection mode) */}
      {selectionMode && (
        <View style={styles.bulkActionBar}>
          <Pressable
            style={[styles.bulkDeleteBtn, selectedIds.size === 0 && styles.disabled]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
          >
            <AppIcon name="trash-2" size={16} color={colors.danger} />
            <Text style={styles.bulkDeleteText}>Delete Selected</Text>
          </Pressable>
        </View>
      )}

      {!selectionMode && (
        <Pressable style={styles.fab} onPress={() => setFormVisible(true)}>
          <AppIcon name="plus" size={22} color="#fff" />
          <Text style={styles.fabText}>New Habit</Text>
        </Pressable>
      )}

      <HabitForm
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onSubmit={addHabit}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionCount: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  selectionSelectAll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  selectionSelectAllText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.text,
  },
  headerSub: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  countText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  gridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    flex: 1,
    minHeight: 112,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: "space-between",
    position: "relative",
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  selectionDot: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.mutedText,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.habitBadgeLight,
    borderWidth: 1,
    borderColor: colors.habitBadge,
    marginBottom: spacing.xs,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  cardMetaText: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "600",
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    fontSize: fontSize.sm,
  },
  bulkActionBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bulkDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  bulkDeleteText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.4,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fabText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
