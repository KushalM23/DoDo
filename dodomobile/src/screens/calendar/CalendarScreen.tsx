import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { colors } from "../../theme/colors";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
      const day = t.scheduledAt.slice(0, 10);
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
                <View style={styles.habitDot} />
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
  },
  pageName: {
    fontSize: 16,
    color: colors.mutedText,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  monthLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
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
    borderRadius: 12,
  },
  dayHeader: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  dayNum: {
    color: colors.text,
    fontSize: 14,
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
  habitsSection: {
    marginTop: 24,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  habitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  habitText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  habitFreq: {
    color: colors.mutedText,
    fontSize: 12,
  },
});
