import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/common/AppIcon";
import { cx, tw } from "@/lib/tw";
import { useAuth } from "@/providers/AuthContext";
import { useHabits } from "@/providers/HabitsContext";
import { usePreferences } from "@/providers/PreferencesContext";
import { DateWheelPickerModal } from "@/components/overlays/DateWheelPickerModal";
import {
  resolveCalendarMonthSelection,
  formatCalendarTriggerLabel,
} from "@/components/overlays/DateWheelPickerUtils";
import { readDb } from "@/lib/local/db";
import { runSync } from "@/lib/local/syncEngine";
import { habitAppliesToDate, isHabitPausedOnDate } from "@/utils/habits";
import {
  formatTime,
  getCalendarOffset,
  getWeekdayLabels,
  toLocalDateKey,
} from "@/utils/dateTime";
import type { Task } from "@/types/task";
import type { Habit } from "@/types/habit";

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

type CalendarCell = {
  key: string;
  date: Date;
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

const DAY_MINUTES = 24 * 60;
const MIN_DURATION_MINUTES = 15;
const AXIS_HEIGHT = 28;
const TIMELINE_END_BUFFER = 60;
const BASE_PX_PER_MINUTE = 1;
const MIN_PX_PER_MINUTE = 0.47;
const MAX_PX_PER_MINUTE = 2.4;
const SLOT_SIZE = 96;
const EVENT_AXIS_GAP = 5;
const MIN_EVENT_AXIS_SIZE = 26;

function fallbackHabitStartMinute(habit: Habit, index: number): number {
  const seed = habit.id
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const base = 6 * 60 + ((seed + index * 31) % (12 * 60));
  return Math.min(23 * 60, Math.max(0, base));
}

function toTaskEvent(task: Task): TimelineEvent {
  const start = new Date(task.scheduledAt);
  const end = new Date(task.deadline);
  let startMinute = start.getHours() * 60 + start.getMinutes();
  let endMinute = end.getHours() * 60 + end.getMinutes();

  if (endMinute <= startMinute) {
    endMinute = Math.min(
      DAY_MINUTES,
      startMinute + Math.max(task.durationMinutes ?? 30, MIN_DURATION_MINUTES),
    );
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

function toHabitEvent(
  habit: Habit,
  dateKey: string,
  index: number,
): TimelineEvent {
  const startMinute =
    habit.timeMinute ?? fallbackHabitStartMinute(habit, index);
  const duration = habit.durationMinutes ?? 30;
  const endMinute = Math.min(
    DAY_MINUTES,
    startMinute + Math.max(MIN_DURATION_MINUTES, duration),
  );

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

function layoutVerticalEventsIntoColumns(events: TimelineEvent[]): {
  placed: RowPlacedTimelineEvent[];
  columnCount: number;
} {
  const sorted = [...events].sort((a, b) => {
    if (a.startMinute !== b.startMinute) {
      return a.startMinute - b.startMinute;
    }
    return a.endMinute - b.endMinute;
  });

  const colEndMinutes: number[] = [];
  const placed: RowPlacedTimelineEvent[] = [];

  sorted.forEach((event) => {
    let col = colEndMinutes.findIndex((colEnd) => colEnd <= event.startMinute);
    if (col === -1) {
      col = colEndMinutes.length;
      colEndMinutes.push(event.endMinute);
    } else {
      colEndMinutes[col] = event.endMinute;
    }
    placed.push({ ...event, row: col });
  });

  return { placed, columnCount: Math.max(1, colEndMinutes.length) };
}

function buildMonthCells(
  month: Date,
  weekStart: "sunday" | "monday",
): CalendarCell[] {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstOffset = getCalendarOffset(monthStart.getDay(), weekStart);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - firstOffset,
  );
  const cells: CalendarCell[] = [];
  const todayKey = toLocalDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    const dateKey = toLocalDateKey(date);
    cells.push({
      key: `${dateKey}-${index}`,
      date,
      dateKey,
      dayNum: date.getDate(),
      inCurrentMonth:
        date.getMonth() === month.getMonth() &&
        date.getFullYear() === month.getFullYear(),
      isToday: dateKey === todayKey,
    });
  }

  let startTrim = 0;
  while (
    startTrim < cells.length &&
    cells.slice(startTrim, startTrim + 7).every((c) => !c.inCurrentMonth)
  ) {
    startTrim += 7;
  }

  let endTrim = cells.length;
  while (
    endTrim > startTrim &&
    cells.slice(endTrim - 7, endTrim).every((c) => !c.inCurrentMonth)
  ) {
    endTrim -= 7;
  }

  return cells.slice(startTrim, endTrim);
}

function monthWindow(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function taskStatusByDate(tasks: Task[]) {
  const bucket: Record<string, { total: number; completed: number }> = {};
  tasks.forEach((task) => {
    const key = toLocalDateKey(task.scheduledAt);
    if (!bucket[key]) {
      bucket[key] = { total: 0, completed: 0 };
    }
    bucket[key].total += 1;
    if (task.completed) {
      bucket[key].completed += 1;
    }
  });
  return Object.fromEntries(
    Object.entries(bucket).map(([key, value]) => [
      key,
      value.completed === value.total ? "done" : "partial",
    ]),
  );
}

function habitStatusByDate(
  habits: Habit[],
  dates: string[],
  completionMap: Record<string, Record<string, boolean>>,
) {
  return Object.fromEntries(
    dates.map((dateKey) => {
      const applies = habits.filter((habit) =>
        habitAppliesToDate(habit, dateKey) && !isHabitPausedOnDate(habit, dateKey),
      );
      if (applies.length === 0) {
        return [dateKey, "none"];
      }
      const completed = applies.filter(
        (habit) => completionMap[habit.id]?.[dateKey],
      ).length;
      return [dateKey, completed === applies.length ? "done" : "partial"];
    }),
  );
}

export function CalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { habits, completionMap, loadHistory } = useHabits();
  const { preferences } = usePreferences();
  const userId = user?.id ?? null;

  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toLocalDateKey(today),
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);
  const [pxPerMinute, setPxPerMinute] = useState(BASE_PX_PER_MINUTE);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const pxPerMinuteRef = useRef(BASE_PX_PER_MINUTE);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(BASE_PX_PER_MINUTE);
  const isPinchingRef = useRef(false);

  useEffect(() => {
    pxPerMinuteRef.current = pxPerMinute;
  }, [pxPerMinute]);

  useEffect(() => {
    if (!userId) {
      setMonthTasks([]);
      return;
    }
    const activeUserId = userId;

    const { startAt, endAt } = monthWindow(currentDate);
    let cancelled = false;

    async function load() {
      const localTasks = await readDb((db) =>
        (db.tasks[activeUserId] ?? [])
          .filter((task: Task) => !task.deletedAt)
          .filter(
            (task: Task) =>
              task.scheduledAt >= startAt && task.scheduledAt < endAt,
          ),
      );
      if (!cancelled) {
        setMonthTasks(localTasks);
      }
      const didSync = await runSync(activeUserId, "manual");
      if (!didSync || cancelled) {
        return;
      }
      const reconciledTasks = await readDb((db) =>
        (db.tasks[activeUserId] ?? [])
          .filter((task: Task) => !task.deletedAt)
          .filter(
            (task: Task) =>
              task.scheduledAt >= startAt && task.scheduledAt < endAt,
          ),
      );
      if (!cancelled) {
        setMonthTasks(reconciledTasks);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentDate, userId]);

  const allMonthCells = useMemo(
    () => buildMonthCells(currentDate, preferences.weekStart),
    [currentDate, preferences.weekStart],
  );

  useEffect(() => {
    if (allMonthCells.length === 0) {
      return;
    }
    const startDate = allMonthCells[0].dateKey;
    const endDate = allMonthCells[allMonthCells.length - 1].dateKey;
    void loadHistory({ startDate, endDate });
  }, [allMonthCells, loadHistory]);

  const statusMap = useMemo(() => taskStatusByDate(monthTasks), [monthTasks]);
  const habitStatusMap = useMemo(
    () =>
      habitStatusByDate(
        habits,
        allMonthCells.map((cell) => cell.dateKey),
        completionMap,
      ),
    [allMonthCells, completionMap, habits],
  );

  const tasksForSelectedDate: TimelineEvent[] = useMemo(() => {
    const taskEvents = monthTasks
      .filter(
        (task) => toLocalDateKey(new Date(task.scheduledAt)) === selectedDate,
      )
      .map(toTaskEvent);

    const habitEvents = habits
      .filter((habit) => habitAppliesToDate(habit, selectedDate) && !isHabitPausedOnDate(habit, selectedDate))
      .map((habit, index) => ({
        ...toHabitEvent(habit, selectedDate, index),
        completed: !!completionMap[habit.id]?.[selectedDate],
      }));

    return [...taskEvents, ...habitEvents].sort(
      (a, b) => a.startMinute - b.startMinute,
    );
  }, [completionMap, habits, monthTasks, selectedDate]);

  const timelineLayout = useMemo(
    () => layoutVerticalEventsIntoColumns(tasksForSelectedDate),
    [tasksForSelectedDate],
  );

  const timelineMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = 0; minute <= DAY_MINUTES; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, []);

  const timelineExtent = (DAY_MINUTES + TIMELINE_END_BUFFER) * pxPerMinute;
  const timelineBodyWidth = timelineLayout.columnCount * SLOT_SIZE;
  const calendarRowCount = Math.max(1, Math.ceil(allMonthCells.length / 7));
  const calendarDaySize = calendarRowCount <= 5 ? 62 : 54;
  const hasTimelineEvents = tasksForSelectedDate.length > 0;

  const clampScale = useCallback((value: number) => {
    return Math.max(MIN_PX_PER_MINUTE, Math.min(MAX_PX_PER_MINUTE, value));
  }, []);

  const clampScrollTop = useCallback(
    (value: number, scale: number, container: HTMLDivElement) => {
      const maxScroll = Math.max(
        0,
        (DAY_MINUTES + TIMELINE_END_BUFFER) * scale - container.clientHeight,
      );
      return Math.max(0, Math.min(maxScroll, value));
    },
    [],
  );

  const applyTimelineScale = useCallback(
    (rawNextScale: number, focalY: number) => {
      const container = timelineScrollRef.current;
      if (!container) {
        return;
      }

      const previousScale = pxPerMinuteRef.current;
      const nextScale = clampScale(rawNextScale);

      if (Math.abs(nextScale - previousScale) < 0.001) {
        return;
      }

      const minuteAtFocal = (container.scrollTop + focalY) / previousScale;

      pxPerMinuteRef.current = nextScale;
      setPxPerMinute(nextScale);

      requestAnimationFrame(() => {
        const activeContainer = timelineScrollRef.current;
        if (!activeContainer) {
          return;
        }

        const nextScroll = minuteAtFocal * nextScale - focalY;
        activeContainer.scrollTop = clampScrollTop(
          nextScroll,
          nextScale,
          activeContainer,
        );
      });
    },
    [clampScale, clampScrollTop],
  );

  const touchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) {
      return 0;
    }
    const first = touches[0];
    const second = touches[1];
    const dx = second.clientX - first.clientX;
    const dy = second.clientY - first.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const touchFocalY = useCallback(
    (touches: React.TouchList, container: HTMLDivElement) => {
      if (touches.length < 2) {
        return container.clientHeight / 2;
      }
      const first = touches[0];
      const second = touches[1];
      const rect = container.getBoundingClientRect();
      return (first.clientY + second.clientY) / 2 - rect.top;
    },
    [],
  );

  const handleTimelineTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length < 2) {
        return;
      }

      const container = timelineScrollRef.current;
      if (!container) {
        return;
      }

      const distance = touchDistance(event.touches);
      if (distance <= 0) {
        return;
      }

      isPinchingRef.current = true;
      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = pxPerMinuteRef.current;
    },
    [touchDistance],
  );

  const handleTimelineTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isPinchingRef.current || event.touches.length < 2) {
        return;
      }

      const container = timelineScrollRef.current;
      if (!container || pinchStartDistanceRef.current <= 0) {
        return;
      }

      const currentDistance = touchDistance(event.touches);
      if (currentDistance <= 0) {
        return;
      }

      event.preventDefault();

      const scaleFactor = currentDistance / pinchStartDistanceRef.current;
      const focalY = touchFocalY(event.touches, container);

      applyTimelineScale(pinchStartScaleRef.current * scaleFactor, focalY);
    },
    [applyTimelineScale, touchDistance, touchFocalY],
  );

  const handleTimelineTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length >= 2) {
        return;
      }

      isPinchingRef.current = false;
      pinchStartDistanceRef.current = 0;
      pinchStartScaleRef.current = pxPerMinuteRef.current;
    },
    [],
  );

  const handleTimelineWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();

      const container = timelineScrollRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const focalY = event.clientY - rect.top;
      const zoomFactor = Math.exp(-event.deltaY * 0.0025);

      applyTimelineScale(pxPerMinuteRef.current * zoomFactor, focalY);
    },
    [applyTimelineScale],
  );

  const canZoomOut = pxPerMinute > MIN_PX_PER_MINUTE + 0.001;
  const canZoomIn = pxPerMinute < MAX_PX_PER_MINUTE - 0.001;

  const handleTimelineZoomStep = useCallback(
    (direction: -1 | 1) => {
      const container = timelineScrollRef.current;
      if (!container) {
        return;
      }

      const focalY = container.clientHeight / 2;
      const zoomFactor = direction > 0 ? 1.18 : 1 / 1.18;
      applyTimelineScale(pxPerMinuteRef.current * zoomFactor, focalY);
    },
    [applyTimelineScale],
  );

  function shiftMonth(delta: number) {
    const targetMonthDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + delta,
      1,
    );
    const nextSelection = resolveCalendarMonthSelection(
      targetMonthDate.getMonth(),
      targetMonthDate.getFullYear(),
    );
    setCurrentDate(nextSelection.currentDate);
    setSelectedDate(nextSelection.selectedDate);
  }

  function formatEventTimeRange(
    startMinute: number,
    endMinute: number,
  ): string {
    const startHour = Math.floor(startMinute / 60) % 24;
    const startMin = startMinute % 60;
    const endHour = Math.floor(endMinute / 60) % 24;
    const endMin = endMinute % 60;

    const startLabel = formatTime(
      new Date(2000, 0, 1, startHour, startMin, 0),
      preferences.timeFormat,
    ).replace(/\s*[AP]M$/i, "");

    const endLabel = formatTime(
      new Date(2000, 0, 1, endHour, endMin, 0),
      preferences.timeFormat,
    ).replace(/\s*[AP]M$/i, "");

    return `${startLabel}-${endLabel}`;
  }

  return (
    <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)] xl:[grid-template-rows:minmax(0,1fr)] xl:overflow-hidden">
      <section className="flex h-full min-h-0 flex-col px-2 py-2 sm:px-3 xl:px-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px"
            onClick={() => shiftMonth(-1)}
          >
            <AppIcon name="chevron-left" size={18} />
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-center font-display text-[36px] tracking-[-0.6px] text-text transition hover:opacity-85"
            onClick={() => setIsMonthPickerOpen(true)}
          >
            {formatCalendarTriggerLabel(currentDate)}
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px"
            onClick={() => shiftMonth(1)}
          >
            <AppIcon name="chevron-right" size={18} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-7 justify-items-center">
          {getWeekdayLabels(preferences.weekStart).map((day) => (
            <span
              key={day}
              className="text-lg font-sans-semibold text-muted-text"
            >
              {day}
            </span>
          ))}
        </div>

        <div
          className="grid h-full min-h-0 flex-1 grid-cols-7 gap-y-2 pt-1"
          style={{
            gridTemplateRows: `repeat(${calendarRowCount}, minmax(0, 1fr))`,
          }}
        >
          {allMonthCells.map((cell) => {
            const taskStatus = statusMap[cell.dateKey] ?? "none";
            const habitStatus = habitStatusMap[cell.dateKey] ?? "none";

            if (!cell.inCurrentMonth) {
              return (
                <div
                  key={cell.key}
                  className="flex h-full w-full items-center justify-center"
                  aria-hidden="true"
                >
                  <div
                    style={{ height: calendarDaySize, width: calendarDaySize }}
                  />
                </div>
              );
            }

            return (
              <div
                key={cell.key}
                className="flex h-full w-full items-center justify-center"
              >
                <button
                  type="button"
                  className={cx(
                    "flex flex-col items-center justify-center rounded-full text-text transition",
                    cell.dateKey === selectedDate && "bg-text text-background",
                  )}
                  style={{ height: calendarDaySize, width: calendarDaySize }}
                  onClick={() => {
                    setSelectedDate(cell.dateKey);
                    setCurrentDate(cell.date);
                  }}
                >
                  <span
                    className={cx(
                      "text-sm font-sans-semibold leading-none",
                      cell.isToday &&
                        cell.dateKey !== selectedDate &&
                        "font-sans-bold text-accent",
                      cell.dateKey === selectedDate &&
                        "font-sans-bold text-background",
                    )}
                  >
                    {cell.dayNum}
                  </span>

                  <div className="mt-4 flex h-[4px] items-center gap-1">
                    {taskStatus !== "none" ? (
                      <span
                        className={cx(
                          "h-[8px] w-[8px] rounded-full border-2 border-accent",
                          taskStatus === "done" && "bg-accent",
                        )}
                      />
                    ) : null}
                    {habitStatus !== "none" ? (
                      <span
                        className={cx(
                          "h-[8px] w-[8px] rounded-full border-2 border-habit-badge",
                          habitStatus === "done" && "bg-habit-badge",
                        )}
                      />
                    ) : null}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex h-full min-h-0 flex-col px-2 py-2 sm:px-3 xl:border-l xl:border-border xl:px-0 xl:pl-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 font-display text-[28px] tracking-[-0.7px]">
              Timeline
            </h2>
            <p className={tw.muted}>
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                undefined,
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                },
              )}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out timeline"
              className={tw.iconBtn}
              disabled={!hasTimelineEvents || !canZoomOut}
              onClick={() => handleTimelineZoomStep(-1)}
            >
              <AppIcon name="minus" size={12} />
            </button>
            <button
              type="button"
              aria-label="Zoom in timeline"
              className={tw.iconBtn}
              disabled={!hasTimelineEvents || !canZoomIn}
              onClick={() => handleTimelineZoomStep(1)}
            >
              <AppIcon name="plus" size={12} />
            </button>
          </div>
        </div>

        <div className="mt-1 flex min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface-light">
          {!hasTimelineEvents ? (
            <div className="grid h-full w-full place-items-center gap-2 p-6 text-center">
              <h3 className="m-0 font-display-semibold tracking-[-0.3px]">
                Nothing scheduled
              </h3>
              <p className={tw.muted}>No tasks or habits for this date.</p>
            </div>
          ) : (
            <div
              ref={timelineScrollRef}
              data-allow-local-zoom="true"
              className="h-full w-full overflow-y-auto overflow-x-auto px-3 py-3 scrollbar-none"
              style={{ touchAction: "pan-x pan-y" }}
              onTouchStart={handleTimelineTouchStart}
              onTouchMove={handleTimelineTouchMove}
              onTouchEnd={handleTimelineTouchEnd}
              onTouchCancel={handleTimelineTouchEnd}
              onWheel={handleTimelineWheel}
            >
              <div
                className="relative"
                style={{
                  height: timelineExtent,
                  width: Math.max(300, timelineBodyWidth + AXIS_HEIGHT + 32),
                }}
              >
                {timelineMarks.map((minute) => {
                  const top = minute * pxPerMinute;
                  const hour = Math.floor(minute / 60) % 24;
                  const mins = minute % 60;
                  return (
                    <div
                      key={`tick_${minute}`}
                      className="absolute left-0 w-[44px]"
                      style={{ top }}
                    >
                      <span className="block pr-1 text-right text-[9px] font-sans-semibold text-muted-text">
                        {formatTime(
                          new Date(2000, 0, 1, hour, mins, 0),
                          preferences.timeFormat,
                        )}
                      </span>
                    </div>
                  );
                })}

                <div
                  className="absolute bottom-0 top-0"
                  style={{ left: AXIS_HEIGHT + 16, width: timelineBodyWidth }}
                >
                  {timelineLayout.placed.map((event) => {
                    const startPx = event.startMinute * pxPerMinute;
                    const endPx = event.endMinute * pxPerMinute;
                    const rawSpan = Math.max(0, endPx - startPx);
                    const appliedGap = Math.min(
                      EVENT_AXIS_GAP,
                      Math.max(0, rawSpan - MIN_EVENT_AXIS_SIZE),
                    );
                    const top = startPx + appliedGap / 2;
                    const eventHeight = Math.max(
                      MIN_EVENT_AXIS_SIZE,
                      rawSpan - appliedGap,
                    );
                    const compact = eventHeight < 44;
                    const left = event.row * SLOT_SIZE + 6;

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={cx(
                          "absolute rounded-[8px] border-[1.5px] px-2 py-2 text-left",
                          compact && "px-1.5 py-1",
                          event.isHabit
                            ? "border-habit-badge bg-habit-badge"
                            : "border-accent bg-accent",
                          event.completed &&
                            (event.isHabit
                              ? "border-habit-badge bg-habit-badge-light"
                              : "border-accent bg-accent-light"),
                        )}
                        style={{
                          top,
                          left,
                          width: Math.max(56, SLOT_SIZE - 12),
                          height: eventHeight,
                        }}
                        onClick={() =>
                          router.push(
                            event.isHabit && event.habitId
                              ? `/habits/${event.habitId}`
                              : `/tasks/${event.taskId}`,
                          )
                        }
                      >
                        <span
                          className={cx(
                            "block truncate text-xs font-sans-bold leading-[1.1]",
                            !event.completed && "text-white",
                            event.completed && "text-text",
                            compact && "text-[11px]",
                          )}
                        >
                          {event.title}
                        </span>

                        {!compact ? (
                          <span
                            className={cx(
                              "mt-0.5 block truncate text-[8px] font-sans-semibold",
                              !event.completed && "text-white/80",
                              event.completed && "text-muted-text",
                            )}
                          >
                            {formatEventTimeRange(
                              event.startMinute,
                              event.endMinute,
                            )}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <DateWheelPickerModal
        mode="calendar-month"
        visible={isMonthPickerOpen}
        value={currentDate}
        onClose={() => setIsMonthPickerOpen(false)}
        onConfirm={({ month, year }) => {
          const nextSelection = resolveCalendarMonthSelection(month, year);
          setCurrentDate(nextSelection.currentDate);
          setSelectedDate(nextSelection.selectedDate);
          setIsMonthPickerOpen(false);
        }}
      />
    </div>
  );
}
