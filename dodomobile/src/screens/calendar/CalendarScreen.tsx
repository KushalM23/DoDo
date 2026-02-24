import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchTasksInRange } from "../../services/api";
import { useHabits } from "../../state/HabitsContext";
import { usePreferences } from "../../state/PreferencesContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { spacing, radii, fontSize } from "../../theme/colors";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";
import { AppIcon } from "../../components/AppIcon";
import { LoadingScreen } from "../../components/LoadingScreen";
import { formatTime, getCalendarOffset, getWeekdayLabels, toLocalDateKey } from "../../utils/dateTime";
import { habitAppliesToDate } from "../../utils/habits";
import type { Habit } from "../../types/habit";
import type { Task } from "../../types/task";
import type { RootStackParamList } from "../../navigation/RootNavigator";

type CalendarCell = {
  key: string;
  date: Date;
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

type DayTaskStatus = "none" | "partial" | "done";
type DayHabitStatus = "none" | "partial" | "done";

type TimelineEvent = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  completed: boolean;
  isHabit: boolean;
  taskId?: string;
  habitId?: string;
};

type RowPlacedTimelineEvent = TimelineEvent & {
  row: number;
};

const DAY_MINUTES = 24 * 60;
const AXIS_HEIGHT = 28;
const MIN_ROW_HEIGHT = 34;
const MAX_ROW_HEIGHT = 64;
const MIN_DURATION_MINUTES = 15;
const BASE_PX_PER_MINUTE = 0.5;
const MIN_PX_PER_MINUTE = 0.4175;
const MAX_PX_PER_MINUTE = 3.5;

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

function habitStatusByDate(
  habits: Habit[],
  dates: string[],
  completionMap: Record<string, Record<string, boolean>>,
): Record<string, DayHabitStatus> {
  const result: Record<string, DayHabitStatus> = {};

  dates.forEach((dateKey) => {
    const applies = habits.filter((habit) => habitAppliesToDate(habit, dateKey));
    if (applies.length === 0) {
      result[dateKey] = "none";
      return;
    }

    const completed = applies.filter((habit) => !!completionMap[habit.id]?.[dateKey]).length;
    if (completed === applies.length) {
      result[dateKey] = "done";
      return;
    }
    result[dateKey] = "partial";
  });

  return result;
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
    taskId: task.id,
    title: task.title,
    startMinute,
    endMinute,
    completed: task.completed,
    isHabit: false,
  };
}

function toHabitEvent(habit: Habit, dateKey: string, index: number): TimelineEvent {
  const startMinute = habit.timeMinute ?? fallbackHabitStartMinute(habit, index);
  const duration = habit.durationMinutes ?? 30;
  const endMinute = Math.min(DAY_MINUTES, startMinute + Math.max(MIN_DURATION_MINUTES, duration));

  return {
    id: `habit_${habit.id}_${dateKey}`,
    habitId: habit.id,
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

function touchDistance(event: GestureResponderEvent): number {
  if (event.nativeEvent.touches.length < 2) return 0;
  const [a, b] = event.nativeEvent.touches;
  const dx = b.pageX - a.pageX;
  const dy = b.pageY - a.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { habits, completionMap, loadHistory, loading: habitsLoading, initialized: habitsInitialized } = useHabits();
  const { preferences } = usePreferences();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const SCREEN_WIDTH = width;
  const calendarWidth = isLandscape ? Math.floor(width * 0.45) : SCREEN_WIDTH;
  const CELL_SIZE = Math.floor((calendarWidth - spacing.lg * 2) / 7);

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateKey(today));
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState(240);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [pxPerMinute, setPxPerMinute] = useState(BASE_PX_PER_MINUTE);
  const timelineScrollRef = useRef<ScrollView | null>(null);
  const timelineScrollXRef = useRef(0);
  const pinchStartDistanceRef = useRef(0);
  const pinchAppliedScaleRef = useRef(BASE_PX_PER_MINUTE);
  const pinchTargetScaleRef = useRef(BASE_PX_PER_MINUTE);
  const pinchFocalXRef = useRef(0);
  const pinchRafRef = useRef<number | null>(null);
  const reloadSpin = useRef(new Animated.Value(0)).current;

  const dayNames = useMemo(() => getWeekdayLabels(preferences.weekStart), [preferences.weekStart]);

  const monthCells = useMemo(
    () => buildMonthCells(currentMonth, preferences.weekStart),
    [currentMonth, preferences.weekStart],
  );

  const monthLabel = useMemo(
    () => currentMonth.toLocaleString("default", { month: "long", year: "numeric" }),
    [currentMonth],
  );

  const todayCompact = useMemo(() => String(new Date().getDate()), []);

  useEffect(() => {
    const { startAt, endAt } = monthWindow(currentMonth);
    setMonthLoading(true);

    fetchTasksInRange(startAt, endAt)
      .then((data) => {
        setMonthTasks(data);
      })
      .catch(() => { })
      .finally(() => {
        setMonthLoading(false);
      });
  }, [currentMonth, reloadTick]);

  useEffect(() => {
    if (monthCells.length === 0) return;
    const startDate = monthCells[0].dateKey;
    const endDate = monthCells[monthCells.length - 1].dateKey;
    void loadHistory({ startDate, endDate }).catch(() => { });
  }, [monthCells, loadHistory, reloadTick]);

  const statusMap = useMemo(() => taskStatusByDate(monthTasks), [monthTasks]);
  const habitStatusMap = useMemo(
    () => habitStatusByDate(habits, monthCells.map((cell) => cell.dateKey), completionMap),
    [habits, monthCells, completionMap],
  );

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
    const habitEvents = habitsForSelectedDate.map((habit, idx) => {
      const event = toHabitEvent(habit, selectedDate, idx);
      return { ...event, completed: !!completionMap[habit.id]?.[selectedDate] };
    });
    return layoutEventsIntoRows([...taskEvents, ...habitEvents]);
  }, [tasksForSelectedDate, habitsForSelectedDate, selectedDate, completionMap]);

  const timelineWidth = DAY_MINUTES * pxPerMinute;
  const timelineMarks = useMemo(() => {
    const minuteStep = pxPerMinute >= 2 ? 30 : pxPerMinute >= 1.2 ? 60 : 120;
    const marks: number[] = [];
    for (let minute = 0; minute <= DAY_MINUTES; minute += minuteStep) {
      marks.push(minute);
    }
    return marks;
  }, [pxPerMinute]);
  const bodyAvailableHeight = Math.max(96, timelineHeight - AXIS_HEIGHT - 8);
  const rowHeight = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, bodyAvailableHeight / rowLayout.rowCount));
  const timelineBodyHeight = rowLayout.rowCount * rowHeight;

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

  function handleReload() {
    reloadSpin.setValue(0);
    Animated.timing(reloadSpin, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setReloadTick((prev) => prev + 1);
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

  function habitStatusForDate(dateKey: string): DayHabitStatus {
    return habitStatusMap[dateKey] ?? "none";
  }

  function onTimelineLayout(event: LayoutChangeEvent) {
    setTimelineHeight(event.nativeEvent.layout.height);
    setTimelineViewportWidth(event.nativeEvent.layout.width);
  }

  function clampScrollX(value: number, scale: number): number {
    const maxX = Math.max(0, DAY_MINUTES * scale - timelineViewportWidth);
    return Math.max(0, Math.min(maxX, value));
  }

  function pinchFocalX(event: GestureResponderEvent): number {
    if (event.nativeEvent.touches.length < 2) return 0;
    const [a, b] = event.nativeEvent.touches;
    return (a.locationX + b.locationX) / 2;
  }

  function startPinch(event: GestureResponderEvent) {
    if (event.nativeEvent.touches.length < 2) return;
    pinchStartDistanceRef.current = touchDistance(event);
    pinchAppliedScaleRef.current = pxPerMinute;
    pinchTargetScaleRef.current = pxPerMinute;
    pinchFocalXRef.current = pinchFocalX(event);
    if (pinchRafRef.current != null) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
  }

  function movePinch(event: GestureResponderEvent) {
    if (event.nativeEvent.touches.length < 2 || pinchStartDistanceRef.current <= 0) return;
    const currentDistance = touchDistance(event);
    if (currentDistance <= 0) return;
    pinchFocalXRef.current = pinchFocalX(event);
    const scaleFactor = currentDistance / pinchStartDistanceRef.current;
    const baseScale = pinchAppliedScaleRef.current;
    const nextScale = Math.max(MIN_PX_PER_MINUTE, Math.min(MAX_PX_PER_MINUTE, baseScale * scaleFactor));
    if (Math.abs(nextScale - pinchTargetScaleRef.current) < 0.005) return;
    pinchTargetScaleRef.current = nextScale;

    if (pinchRafRef.current != null) return;
    pinchRafRef.current = requestAnimationFrame(() => {
      const previousScale = pinchAppliedScaleRef.current;
      const scale = pinchTargetScaleRef.current;
      const focalX = pinchFocalXRef.current;
      const contentX = timelineScrollXRef.current + focalX;
      const minuteAtFocal = previousScale > 0 ? contentX / previousScale : 0;
      const nextScrollX = clampScrollX(minuteAtFocal * scale - focalX, scale);

      pinchAppliedScaleRef.current = scale;
      setPxPerMinute(scale);
      timelineScrollXRef.current = nextScrollX;
      timelineScrollRef.current?.scrollTo({ x: nextScrollX, animated: false });

      pinchStartDistanceRef.current = currentDistance;
      pinchRafRef.current = null;
    });
  }

  function endPinch() {
    if (pinchRafRef.current != null) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
    const clamped = Math.max(MIN_PX_PER_MINUTE, Math.min(MAX_PX_PER_MINUTE, pinchTargetScaleRef.current));
    pinchAppliedScaleRef.current = clamped;
    setPxPerMinute(clamped);
    pinchStartDistanceRef.current = 0;
  }

  function handleTimelinePress(event: RowPlacedTimelineEvent) {
    if (event.isHabit && event.habitId) {
      navigation.navigate("HabitDetail", { habitId: event.habitId });
      return;
    }
    if (event.taskId) {
      navigation.navigate("TaskDetail", { taskId: event.taskId });
    }
  }

  const initialLoading = !habitsInitialized || (habitsLoading && habits.length === 0) || (monthLoading && monthTasks.length === 0);
  const reloadRotate = reloadSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  if (initialLoading) {
    return <LoadingScreen title="Loading calendar" iconName="calendar" />;
  }

  // Calendar grid section (reusable for both portrait and landscape)
  const calendarGrid = (
    <View style={[styles.calendarSection, isLandscape && { flex: 1 }]}>
      <View style={styles.monthControls}>
        <Pressable style={styles.iconBtn} onPress={handlePrevMonth}>
          <AppIcon name="chevron-left" size={16} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable style={styles.iconBtn} onPress={handleNextMonth}>
          <AppIcon name="chevron-right" size={16} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {dayNames.map((dayName) => (
          <View key={dayName} style={[styles.weekHeaderCell, { width: CELL_SIZE }]}>
            <Text style={styles.dayHeader}>{dayName}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {monthCells.map((cell) => {
          const status = statusForDate(cell.dateKey);
          const habitStatus = habitStatusForDate(cell.dateKey);
          const isSelected = cell.dateKey === selectedDate;
          const dateTextColor = isSelected
            ? colors.text
            : (cell.inCurrentMonth ? colors.text : colors.mutedText);

          return (
            <Pressable
              key={cell.key}
              onPress={() => handleSelectDate(cell)}
              style={[
                styles.dayCell,
                { width: CELL_SIZE, height: CELL_SIZE },
                isSelected && styles.daySelected,
                isSelected && cell.isToday && styles.daySelectedToday,
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  { color: dateTextColor },
                  cell.isToday && !isSelected && styles.todayNum,
                  isSelected && styles.selectedDayNum,
                ]}
              >
                {cell.dayNum}
              </Text>

              {cell.inCurrentMonth && (status !== "none" || habitStatus !== "none") && (
                <View style={styles.indicatorRow}>
                  {status !== "none" && (
                    <View style={[styles.statusDot, status === "done" ? styles.doneDot : styles.partialDot]} />
                  )}
                  {habitStatus !== "none" && (
                    <View style={[styles.statusDot, habitStatus === "done" ? styles.habitDoneDot : styles.habitPartialDot]} />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // Timeline section (reusable for both portrait and landscape)
  const timelineSection = (
    <View style={[styles.timelineSection, isLandscape && styles.timelineSectionLandscape]}>
      <Text style={styles.timelineTitle}>Timeline</Text>
      <View
        style={styles.timelineShell}
        onLayout={onTimelineLayout}
        onStartShouldSetResponder={(event) => event.nativeEvent.touches.length >= 2}
        onMoveShouldSetResponder={(event) => event.nativeEvent.touches.length >= 2}
        onResponderGrant={startPinch}
        onResponderMove={movePinch}
        onResponderRelease={endPinch}
        onResponderTerminate={endPinch}
      >
        <ScrollView
          ref={timelineScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timelineScrollContent}
          onScroll={(event) => {
            timelineScrollXRef.current = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          <View style={[styles.timelineTrack, { width: timelineWidth }]}>
            {timelineMarks.map((minute) => {
              const left = minute * pxPerMinute;
              const hour = Math.floor(minute / 60) % 24;
              const mins = minute % 60;
              return (
                <View key={`tick_${minute}`} style={[styles.timeTick, { left }]}>
                  <Text style={styles.timeTickLabel}>
                    {formatTime(new Date(2000, 0, 1, hour, mins, 0), preferences.timeFormat)}
                  </Text>
                </View>
              );
            })}

            <View style={[styles.timelineBody, { top: AXIS_HEIGHT, height: timelineBodyHeight }]}>
              {rowLayout.placed.map((event) => {
                const left = event.startMinute * pxPerMinute;
                const evtWidth = Math.max(42, (event.endMinute - event.startMinute) * pxPerMinute);
                const top = event.row * rowHeight + 6;
                return (
                  <Pressable
                    key={event.id}
                    onPress={() => handleTimelinePress(event)}
                    style={[
                      styles.eventCard,
                      {
                        left,
                        width: evtWidth,
                        top,
                        height: Math.max(28, rowHeight - 12),
                      },
                      event.isHabit ? styles.habitEventBase : styles.taskEventBase,
                      event.completed && (event.isHabit ? styles.habitEventCompleted : styles.taskEventCompleted),
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.eventTitle,
                        !event.isHabit && !event.completed && styles.taskEventTitleOnAccent,
                        event.isHabit && !event.completed && styles.habitEventTitleOnAccent,
                      ]}
                    >
                      {event.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.eventMeta,
                        !event.isHabit && !event.completed && styles.taskEventMetaOnAccent,
                        event.isHabit && !event.completed && styles.habitEventMetaOnAccent,
                      ]}
                    >
                      {event.isHabit ? "Habit" : "Task"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.actionBtn} onPress={handleReload} hitSlop={8}>
            <Animated.View style={{ transform: [{ rotate: reloadRotate }] }}>
              <AppIcon name="rotate-ccw" size={16} color={colors.accent} />
            </Animated.View>
          </Pressable>
          <Pressable style={styles.todayBtn} onPress={handleToday} hitSlop={8}>
            <View style={styles.todayIconWrap}>
              <AppIcon name="calendar" size={18} color={colors.accent} />
              <Text style={styles.todayBtnText}>{todayCompact}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {isLandscape ? (
        // Landscape: calendar left | timeline right
        <View style={styles.landscapeContent}>
          <View style={[styles.landscapeLeft, { width: Math.floor(width * 0.45) }]}>
            {calendarGrid}
          </View>
          <View style={styles.landscapeDivider} />
          <View style={styles.landscapeRight}>
            {timelineSection}
          </View>
        </View>
      ) : (
        // Portrait: stacked top-to-bottom
        <View style={styles.content}>
          {calendarGrid}
          {timelineSection}
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  timelineTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: 0,
    marginBottom: 8,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.accent,
  },
  // Portrait layout
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: 2,
    gap: 0,
  },
  // Landscape layout
  landscapeContent: {
    flex: 1,
    flexDirection: "row",
  },
  landscapeLeft: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  landscapeDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  landscapeRight: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  calendarSection: {
    paddingTop: 0,
    marginBottom: 10,
  },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  todayBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  todayIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  todayBtnText: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: "900",
    position: "absolute",
    bottom: 8,
    lineHeight: 8,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekHeaderCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeader: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    position: "relative",
  },
  daySelected: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: "transparent",
  },
  daySelectedToday: {
    backgroundColor: colors.accentLight,
  },
  dayNum: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  selectedDayNum: {
    fontWeight: "800",
  },
  todayNum: {
    color: colors.accent,
    fontWeight: "700",
  },
  indicatorRow: {
    position: "absolute",
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  doneDot: {
    backgroundColor: colors.accent,
  },
  partialDot: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "transparent",
  },
  habitDoneDot: {
    backgroundColor: colors.habitBadge,
  },
  habitPartialDot: {
    borderWidth: 1,
    borderColor: colors.habitBadge,
    backgroundColor: "transparent",
  },
  timelineSection: {
    flex: 1,
    minHeight: 190,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
  timelineSectionLandscape: {
    borderTopWidth: 0,
    flex: 1,
  },
  timelineShell: {
    flex: 1,
    backgroundColor: "transparent",
  },
  timelineScrollContent: {
    minHeight: "100%",
  },
  timelineTrack: {
    minHeight: AXIS_HEIGHT + MIN_ROW_HEIGHT,
    position: "relative",
    backgroundColor: "transparent",
  },
  timeTick: {
    position: "absolute",
    top: 0,
    height: AXIS_HEIGHT,
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
  eventCard: {
    position: "absolute",
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: "center",
  },
  taskEventBase: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  habitEventBase: {
    backgroundColor: colors.habitBadge,
    borderColor: colors.habitBadge,
  },
  taskEventCompleted: {
    backgroundColor: colors.accentLight,
  },
  habitEventCompleted: {
    backgroundColor: colors.habitBadgeLight,
    borderColor: colors.habitBadge,
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
  taskEventTitleOnAccent: {
    color: colors.text,
    fontWeight: "800",
  },
  taskEventMetaOnAccent: {
    color: colors.background,
  },
  habitEventTitleOnAccent: {
    color: colors.text,
    fontWeight: "800",
  },
  habitEventMetaOnAccent: {
    color: colors.background,
    opacity: 0.9,
  },
});
