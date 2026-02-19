import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchTasksInRange } from "../../services/api";
import { useHabits } from "../../state/HabitsContext";
import { usePreferences } from "../../state/PreferencesContext";
import { colors, spacing, radii, fontSize } from "../../theme/colors";
import { AppIcon } from "../../components/AppIcon";
import { formatDate, formatTime, getCalendarOffset, getWeekdayLabels, toLocalDateKey } from "../../utils/dateTime";
import type { Habit } from "../../types/habit";
import type { Task } from "../../types/task";

type CalendarCell = {
  key: string;
  date: Date;
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

type DayTaskStatus = "none" | "partial" | "done";

type TimelineEvent = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  completed: boolean;
  isHabit: boolean;
};

type RowPlacedTimelineEvent = TimelineEvent & {
  row: number;
};

const DAY_MINUTES = 24 * 60;
const ROW_HEIGHT = 44;
const AXIS_HEIGHT = 34;
const MIN_DURATION_MINUTES = 15;
const BASE_PX_PER_MINUTE = 1.2;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;

function localDateKey(value: Date): string {
  return toLocalDateKey(value);
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function monthWindow(month: Date): { startAt: string; endAt: string } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function buildMonthCells(month: Date, weekStart: "sunday" | "monday"): CalendarCell[] {
  const monthStart = startOfMonth(month);
  const firstOffset = getCalendarOffset(monthStart.getDay(), weekStart);
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstOffset);
  const todayKey = localDateKey(new Date());

  const cells: CalendarCell[] = [];
  for (let idx = 0; idx < 42; idx++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + idx);
    const dateKey = localDateKey(date);
    cells.push({
      key: `${dateKey}_${idx}`,
      date,
      dateKey,
      dayNum: date.getDate(),
      inCurrentMonth: date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

function taskStatusByDate(tasks: Task[]): Record<string, DayTaskStatus> {
  const bucket: Record<string, { total: number; completed: number }> = {};
  for (const task of tasks) {
    const key = toLocalDateKey(task.scheduledAt);
    if (!bucket[key]) {
      bucket[key] = { total: 0, completed: 0 };
    }
    bucket[key].total += 1;
    if (task.completed) {
      bucket[key].completed += 1;
    }
  }

  const result: Record<string, DayTaskStatus> = {};
  Object.entries(bucket).forEach(([key, summary]) => {
    if (summary.total === 0) {
      result[key] = "none";
      return;
    }
    result[key] = summary.completed === summary.total ? "done" : "partial";
  });
  return result;
}

function habitAppliesToDate(habit: Habit, dateKey: string): boolean {
  if (habit.frequency === "daily") return true;
  const created = new Date(habit.createdAt);
  const target = parseDateKey(dateKey);
  return created.getDay() === target.getDay();
}

function fallbackHabitStartMinute(habit: Habit, index: number): number {
  const seed = habit.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const base = 6 * 60 + ((seed + index * 31) % (12 * 60));
  return Math.min(23 * 60, Math.max(0, base));
}

function toTaskEvent(task: Task): TimelineEvent {
  const start = new Date(task.scheduledAt);
  const end = new Date(task.deadline);
  let startMinute = start.getHours() * 60 + start.getMinutes();
  let endMinute = end.getHours() * 60 + end.getMinutes();

  if (endMinute <= startMinute) {
    endMinute = Math.min(DAY_MINUTES, startMinute + Math.max(task.durationMinutes ?? 30, MIN_DURATION_MINUTES));
  }

  startMinute = Math.max(0, Math.min(DAY_MINUTES - 1, startMinute));
  endMinute = Math.max(startMinute + 1, Math.min(DAY_MINUTES, endMinute));

  return {
    id: task.id,
    title: task.title,
    startMinute,
    endMinute,
    completed: task.completed,
    isHabit: false,
  };
}

function toHabitEvent(habit: Habit, dateKey: string, index: number): TimelineEvent {
  const startMinute = habit.startMinute ?? fallbackHabitStartMinute(habit, index);
  const duration = habit.durationMinutes ?? 30;
  const endMinute = Math.min(DAY_MINUTES, startMinute + Math.max(MIN_DURATION_MINUTES, duration));

  return {
    id: `habit_${habit.id}_${dateKey}`,
    title: habit.title,
    startMinute,
    endMinute,
    completed: false,
    isHabit: true,
  };
}

function layoutEventsIntoRows(events: TimelineEvent[]): { placed: RowPlacedTimelineEvent[]; rowCount: number } {
  const sorted = [...events].sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });

  const rowEndMinutes: number[] = [];
  const placed: RowPlacedTimelineEvent[] = [];

  for (const event of sorted) {
    let row = rowEndMinutes.findIndex((rowEnd) => rowEnd <= event.startMinute);
    if (row === -1) {
      row = rowEndMinutes.length;
      rowEndMinutes.push(event.endMinute);
    } else {
      rowEndMinutes[row] = event.endMinute;
    }

    placed.push({ ...event, row });
  }

  return { placed, rowCount: Math.max(1, rowEndMinutes.length) };
}

function distanceBetweenTouches(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }): number {
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function CalendarScreen() {
  const { habits } = useHabits();
  const { preferences } = usePreferences();

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateKey(today));
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const pinchState = useRef({ active: false, startDistance: 0, startZoom: 1 });

  const dayNames = useMemo(() => getWeekdayLabels(preferences.weekStart), [preferences.weekStart]);

  const monthCells = useMemo(
    () => buildMonthCells(currentMonth, preferences.weekStart),
    [currentMonth, preferences.weekStart],
  );

  const monthLabel = useMemo(
    () => currentMonth.toLocaleString("default", { month: "long", year: "numeric" }),
    [currentMonth],
  );

  const todayChipLabel = useMemo(() => formatDate(new Date(), preferences.dateFormat, false), [preferences.dateFormat]);

  useEffect(() => {
    const { startAt, endAt } = monthWindow(currentMonth);
    setLoadingMonth(true);
    setMonthError(null);

    fetchTasksInRange(startAt, endAt)
      .then((data) => {
        setMonthTasks(data);
      })
      .catch((err) => {
        setMonthError(err instanceof Error ? err.message : "Failed to load calendar tasks.");
      })
      .finally(() => {
        setLoadingMonth(false);
      });
  }, [currentMonth]);

  const statusMap = useMemo(() => taskStatusByDate(monthTasks), [monthTasks]);

  const tasksForSelectedDate = useMemo(
    () => monthTasks.filter((task) => toLocalDateKey(task.scheduledAt) === selectedDate),
    [monthTasks, selectedDate],
  );

  const habitsForSelectedDate = useMemo(
    () => habits.filter((habit) => habitAppliesToDate(habit, selectedDate)),
    [habits, selectedDate],
  );

  const rowLayout = useMemo(() => {
    const taskEvents = tasksForSelectedDate.map(toTaskEvent);
    const habitEvents = habitsForSelectedDate.map((habit, idx) => toHabitEvent(habit, selectedDate, idx));
    return layoutEventsIntoRows([...taskEvents, ...habitEvents]);
  }, [tasksForSelectedDate, habitsForSelectedDate, selectedDate]);

  const selectedDateLabel = useMemo(
    () => formatDate(parseDateKey(selectedDate), preferences.dateFormat, true),
    [selectedDate, preferences.dateFormat],
  );

  const pxPerMinute = BASE_PX_PER_MINUTE * zoom;
  const timelineWidth = DAY_MINUTES * pxPerMinute;
  const timelineBodyHeight = Math.max(ROW_HEIGHT, rowLayout.rowCount * ROW_HEIGHT);

  function shiftMonthAndKeepDay(delta: number) {
    const selected = parseDateKey(selectedDate);
    const nextMonth = addMonths(currentMonth, delta);
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(selected.getDate(), daysInNextMonth);
    const aligned = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay);
    setCurrentMonth(nextMonth);
    setSelectedDate(localDateKey(aligned));
  }

  function handlePrevMonth() {
    shiftMonthAndKeepDay(-1);
  }

  function handleNextMonth() {
    shiftMonthAndKeepDay(1);
  }

  function handleToday() {
    const now = new Date();
    setCurrentMonth(startOfMonth(now));
    setSelectedDate(localDateKey(now));
  }

  function handleSelectDate(cell: CalendarCell) {
    setSelectedDate(cell.dateKey);
    if (!cell.inCurrentMonth) {
      setCurrentMonth(startOfMonth(cell.date));
    }
  }

  function statusForDate(dateKey: string): DayTaskStatus {
    return statusMap[dateKey] ?? "none";
  }

  function onPinchStart(event: GestureResponderEvent) {
    const touches = event.nativeEvent.touches;
    if (touches.length !== 2) return;
    pinchState.current.active = true;
    pinchState.current.startDistance = distanceBetweenTouches(touches[0], touches[1]);
    pinchState.current.startZoom = zoom;
  }

  function onPinchMove(event: GestureResponderEvent) {
    const touches = event.nativeEvent.touches;
    if (!pinchState.current.active || touches.length !== 2) return;

    const nextDistance = distanceBetweenTouches(touches[0], touches[1]);
    if (pinchState.current.startDistance <= 0) return;

    const ratio = nextDistance / pinchState.current.startDistance;
    setZoom(clamp(pinchState.current.startZoom * ratio, MIN_ZOOM, MAX_ZOOM));
  }

  function onPinchEnd() {
    pinchState.current.active = false;
    pinchState.current.startDistance = 0;
    pinchState.current.startZoom = zoom;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Text style={styles.pageName}>Calendar</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topHalf}>
          <View style={styles.monthControls}>
            <Pressable style={styles.iconBtn} onPress={handlePrevMonth}>
              <AppIcon name="chevron-left" size={17} color={colors.text} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.iconBtn} onPress={handleNextMonth}>
              <AppIcon name="chevron-right" size={17} color={colors.text} />
            </Pressable>
          </View>

          <Pressable style={styles.todayChip} onPress={handleToday}>
            <AppIcon name="calendar" size={12} color={colors.accent} />
            <Text style={styles.todayChipText}>{todayChipLabel}</Text>
          </Pressable>

          <View style={styles.weekRow}>
            {dayNames.map((dayName) => (
              <View key={dayName} style={styles.weekHeaderCell}>
                <Text style={styles.dayHeader}>{dayName}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {monthCells.map((cell) => {
              const status = statusForDate(cell.dateKey);
              const isSelected = cell.dateKey === selectedDate;
              const dateTextColor = cell.inCurrentMonth ? colors.text : colors.mutedText;

              return (
                <Pressable
                  key={cell.key}
                  onPress={() => handleSelectDate(cell)}
                  style={[
                    styles.dayCell,
                    status === "done" && styles.dayDone,
                    status === "partial" && styles.dayPartial,
                    isSelected && styles.daySelected,
                    cell.isToday && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      { color: status === "done" ? "#fff" : dateTextColor },
                      cell.isToday && !isSelected && status !== "done" && styles.todayNum,
                    ]}
                  >
                    {cell.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loadingMonth ? (
            <View style={styles.monthLoadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Loading month</Text>
            </View>
          ) : null}
          {monthError ? <Text style={styles.errorText}>{monthError}</Text> : null}
        </View>

        <View style={styles.bottomHalf}>
          <View style={styles.dayHeaderRow}>
            <Text style={styles.sectionTitle}>{selectedDateLabel}</Text>
            <Text style={styles.sectionMeta}>
              {rowLayout.placed.length} item{rowLayout.placed.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Text style={styles.zoomHint}>Pinch to zoom timeline</Text>

          <View
            style={styles.timelineShell}
            onTouchStart={onPinchStart}
            onTouchMove={onPinchMove}
            onTouchEnd={onPinchEnd}
            onTouchCancel={onPinchEnd}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.timelineScrollContent}>
              <View style={[styles.timelineTrack, { width: timelineWidth }]}> 
                {Array.from({ length: 25 }).map((_, hour) => {
                  const left = hour * 60 * pxPerMinute;
                  return (
                    <View key={`tick_${hour}`} style={[styles.timeTick, { left }]}> 
                      <Text style={styles.timeTickLabel}>
                        {formatTime(new Date(2000, 0, 1, hour % 24, 0, 0), preferences.timeFormat)}
                      </Text>
                    </View>
                  );
                })}

                <View style={[styles.timelineBody, { top: AXIS_HEIGHT, height: timelineBodyHeight }]}> 
                  {Array.from({ length: 25 }).map((_, hour) => {
                    const left = hour * 60 * pxPerMinute;
                    return <View key={`grid_${hour}`} style={[styles.timeGridLine, { left }]} />;
                  })}

                  {Array.from({ length: rowLayout.rowCount }).map((_, row) => {
                    const top = row * ROW_HEIGHT;
                    return <View key={`row_${row}`} style={[styles.rowDivider, { top }]} />;
                  })}

                  {rowLayout.placed.map((event) => {
                    const left = event.startMinute * pxPerMinute;
                    const width = Math.max(40, (event.endMinute - event.startMinute) * pxPerMinute);
                    const top = event.row * ROW_HEIGHT + 6;
                    return (
                      <View
                        key={event.id}
                        style={[
                          styles.eventCard,
                          {
                            left,
                            width,
                            top,
                          },
                          event.isHabit ? styles.habitEvent : styles.taskEvent,
                          event.completed && styles.completedEvent,
                        ]}
                      >
                        <Text numberOfLines={1} style={styles.eventTitle}>
                          {event.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.eventMeta}>
                          {event.isHabit ? "Habit" : "Task"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
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
  pageName: {
    fontSize: fontSize.md,
    color: colors.mutedText,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  topHalf: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    position: "relative",
  },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingRight: 76,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLight,
  },
  monthLabel: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  todayChip: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  todayChipText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  weekHeaderCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    height: 20,
  },
  dayHeader: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    borderRadius: radii.sm,
  },
  dayDone: {
    backgroundColor: colors.accent,
  },
  dayPartial: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelected: {
    borderWidth: 1,
    borderColor: colors.text,
  },
  dayToday: {
    shadowColor: colors.accent,
  },
  dayNum: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  todayNum: {
    color: colors.accent,
    fontWeight: "700",
  },
  monthLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  bottomHalf: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  sectionMeta: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  zoomHint: {
    color: colors.mutedText,
    fontSize: 10,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  timelineShell: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  timelineScrollContent: {
    minHeight: "100%",
  },
  timelineTrack: {
    minHeight: AXIS_HEIGHT + ROW_HEIGHT,
    position: "relative",
    backgroundColor: colors.background,
  },
  timeTick: {
    position: "absolute",
    top: 0,
    height: AXIS_HEIGHT,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 4,
    justifyContent: "center",
  },
  timeTickLabel: {
    color: colors.mutedText,
    fontSize: 9,
    fontWeight: "600",
  },
  timelineBody: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  timeGridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    opacity: 0.8,
  },
  rowDivider: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eventCard: {
    position: "absolute",
    height: ROW_HEIGHT - 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: "center",
  },
  taskEvent: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  habitEvent: {
    backgroundColor: colors.habitBadgeLight,
    borderColor: colors.habitBadge,
  },
  completedEvent: {
    opacity: 0.55,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  eventMeta: {
    color: colors.mutedText,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
});
