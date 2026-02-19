import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Feather";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { colors, spacing, radii, fontSize } from "../../theme/colors";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateStr(isoString: string): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthDays(): { dateStr: string; dayNum: number; dayOfWeek: number; isToday: boolean }[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const days: { dateStr: string; dayNum: number; dayOfWeek: number; isToday: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    days.push({
      dateStr,
      dayNum: d,
      dayOfWeek: date.getDay(),
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

export function CalendarScreen() {
  const { tasks } = useTasks();
  const { habits } = useHabits();

  const monthDays = useMemo(() => getMonthDays(), []);

  // Map date → count of tasks
  const taskCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      const day = toLocalDateStr(t.scheduledAt);
      map[day] = (map[day] ?? 0) + 1;
    }
    return map;
  }, [tasks]);

  const today = new Date();
  const monthLabel = today.toLocaleString("default", { month: "long", year: "numeric" });

  // Pad the first week
  const firstDayOfWeek = monthDays[0]?.dayOfWeek ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Text style={styles.pageName}>Calendar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.monthLabel}>{monthLabel}</Text>

        {/* Day names header */}
        <View style={styles.weekRow}>
          {DAY_NAMES.map((d) => (
            <View key={d} style={styles.dayCell}>
              <Text style={styles.dayHeader}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {/* Empty cells for padding */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.dayCell} />
          ))}

          {monthDays.map((day) => {
            const count = taskCountMap[day.dateStr] ?? 0;
            return (
              <View key={day.dateStr} style={[styles.dayCell, day.isToday && styles.todayCell]}>
                <Text style={[styles.dayNum, day.isToday && styles.todayNum]}>{day.dayNum}</Text>
                {count > 0 && (
                  <View style={styles.dotRow}>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <View key={i} style={styles.dot} />
                    ))}
                  </View>
                )}
                {count > 3 && (
                  <Text style={styles.moreText}>+{count - 3}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Habits summary */}
        {habits.length > 0 && (
          <View style={styles.habitsSection}>
            <Text style={styles.sectionTitle}>Active Habits</Text>
            {habits.map((h) => (
              <View key={h.id} style={styles.habitRow}>
                <Icon name="repeat" size={14} color={colors.accent} />
                <Text style={styles.habitText}>{h.title}</Text>
                <Text style={styles.habitFreq}>{h.frequency}</Text>
              </View>
            ))}
          </View>
        )}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.accent,
  },
  pageName: {
    fontSize: fontSize.md,
    color: colors.mutedText,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xxl + spacing.md,
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  todayCell: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
  },
  dayHeader: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  dayNum: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  todayNum: {
    color: colors.accent,
    fontWeight: "700",
  },
  dotRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  moreText: {
    color: colors.mutedText,
    fontSize: 8,
    fontWeight: "600",
    marginTop: 1,
  },
  habitsSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  habitText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "500",
    flex: 1,
  },
  habitFreq: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
  },
});
