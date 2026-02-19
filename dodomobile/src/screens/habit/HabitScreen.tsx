import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HabitForm } from "../../components/HabitForm";
import { AppIcon } from "../../components/AppIcon";
import { useHabits } from "../../state/HabitsContext";
import { usePreferences } from "../../state/PreferencesContext";
import type { Habit } from "../../types/habit";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { colors, fontSize, radii, spacing } from "../../theme/colors";
import { formatHabitFrequency, minuteToLabel } from "../../utils/habits";

export function HabitScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { habits, addHabit } = useHabits();
  const { preferences } = usePreferences();
  const [formVisible, setFormVisible] = useState(false);

  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => a.title.localeCompare(b.title));
  }, [habits]);

  function openHabit(habit: Habit) {
    navigation.navigate("HabitDetail", { habitId: habit.id });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Habits</Text>
          <Text style={styles.headerSub}>One day at a time</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{sortedHabits.length}</Text>
        </View>
      </View>

      <FlatList
        data={sortedHabits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={sortedHabits.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openHabit(item)}>
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
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <AppIcon name="repeat" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Create a recurring habit to start building streaks.</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => setFormVisible(true)}>
        <AppIcon name="plus" size={22} color="#fff" />
        <Text style={styles.fabText}>New Habit</Text>
      </Pressable>

      <HabitForm
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onSubmit={addHabit}
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
    paddingTop: 14,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
