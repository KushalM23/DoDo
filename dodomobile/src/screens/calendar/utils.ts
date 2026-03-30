import {getCalendarOffset, toLocalDateKey} from '../../utils/dateTime';
import {
  resolveCalendarMonthSelection,
  shiftCalendarMonth,
} from '../../components/overlays/dateWheelPickerUtils';
import {habitAppliesToDate} from '../../utils/habits';
import type {Habit} from '../../types/habit';
import type {Task} from '../../types/task';

export type CalendarCell = {
  key: string;
  date: Date;
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export type DayTaskStatus = 'none' | 'partial' | 'done';
export type DayHabitStatus = 'none' | 'partial' | 'done';

export type TimelineEvent = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  completed: boolean;
  isHabit: boolean;
  taskId?: string;
  habitId?: string;
};

export type RowPlacedTimelineEvent = TimelineEvent & {
  row: number;
};

export const DAY_MINUTES = 24 * 60;
export const AXIS_HEIGHT = 28;
export const MIN_ROW_HEIGHT = 34;
export const MAX_ROW_HEIGHT = 64;
export const MIN_DURATION_MINUTES = 15;
export const BASE_PX_PER_MINUTE = 0.7;
export const MIN_PX_PER_MINUTE = 0.55;
export const MAX_PX_PER_MINUTE = 3.5;

export function localDateKey(value: Date): string {
  return toLocalDateKey(value);
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

export {resolveCalendarMonthSelection, shiftCalendarMonth};

export function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

export function addWeeks(value: Date, weeks: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function getStartOfWeek(
  date: Date,
  weekStart: 'sunday' | 'monday',
): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff =
    d.getDate() -
    day +
    (day === 0 && weekStart === 'monday' ? -6 : weekStart === 'monday' ? 1 : 0);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function monthWindow(month: Date): {startAt: string; endAt: string} {
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
  return {startAt: start.toISOString(), endAt: end.toISOString()};
}

export function buildMonthCells(
  month: Date,
  weekStart: 'sunday' | 'monday',
): CalendarCell[] {
  const monthStart = startOfMonth(month);
  const firstOffset = getCalendarOffset(monthStart.getDay(), weekStart);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - firstOffset,
  );
  const todayKey = localDateKey(new Date());

  const cells: CalendarCell[] = [];
  for (let idx = 0; idx < 42; idx++) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + idx,
    );
    const dateKey = localDateKey(date);
    cells.push({
      key: `${dateKey}_${idx}`,
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
    cells.slice(startTrim, startTrim + 7).every(c => !c.inCurrentMonth)
  ) {
    startTrim += 7;
  }
  let endTrim = cells.length;
  while (
    endTrim > startTrim &&
    cells.slice(endTrim - 7, endTrim).every(c => !c.inCurrentMonth)
  ) {
    endTrim -= 7;
  }

  return cells.slice(startTrim, endTrim);
}

export function buildWeekCells(
  currentDate: Date,
  weekStart: 'sunday' | 'monday',
): CalendarCell[] {
  const weekStartD = getStartOfWeek(currentDate, weekStart);
  const todayKey = localDateKey(new Date());

  const cells: CalendarCell[] = [];
  for (let idx = 0; idx < 7; idx++) {
    const date = new Date(
      weekStartD.getFullYear(),
      weekStartD.getMonth(),
      weekStartD.getDate() + idx,
    );
    const dateKey = localDateKey(date);
    cells.push({
      key: `${dateKey}_${idx}`,
      date,
      dateKey,
      dayNum: date.getDate(),
      inCurrentMonth:
        date.getMonth() === currentDate.getMonth() &&
        date.getFullYear() === currentDate.getFullYear(),
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

export function taskStatusByDate(tasks: Task[]): Record<string, DayTaskStatus> {
  const bucket: Record<string, {total: number; completed: number}> = {};
  for (const task of tasks) {
    const key = toLocalDateKey(task.scheduledAt);
    if (!bucket[key]) {
      bucket[key] = {total: 0, completed: 0};
    }
    bucket[key].total += 1;
    if (task.completed) {
      bucket[key].completed += 1;
    }
  }

  const result: Record<string, DayTaskStatus> = {};
  Object.entries(bucket).forEach(([key, summary]) => {
    if (summary.total === 0) {
      result[key] = 'none';
      return;
    }
    result[key] = summary.completed === summary.total ? 'done' : 'partial';
  });
  return result;
}

export function habitStatusByDate(
  habits: Habit[],
  dates: string[],
  completionMap: Record<string, Record<string, boolean>>,
): Record<string, DayHabitStatus> {
  const result: Record<string, DayHabitStatus> = {};

  dates.forEach(dateKey => {
    const applies = habits.filter(habit => habitAppliesToDate(habit, dateKey));
    if (applies.length === 0) {
      result[dateKey] = 'none';
      return;
    }

    const completed = applies.filter(
      habit => !!completionMap[habit.id]?.[dateKey],
    ).length;
    if (completed === applies.length) {
      result[dateKey] = 'done';
      return;
    }
    result[dateKey] = 'partial';
  });

  return result;
}

export function fallbackHabitStartMinute(habit: Habit, index: number): number {
  const seed = habit.id
    .split('')
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const base = 6 * 60 + ((seed + index * 31) % (12 * 60));
  return Math.min(23 * 60, Math.max(0, base));
}

export function toTaskEvent(task: Task): TimelineEvent {
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

export function toHabitEvent(
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

export function layoutEventsIntoRows(events: TimelineEvent[]): {
  placed: RowPlacedTimelineEvent[];
  rowCount: number;
} {
  const sorted = [...events].sort((a, b) => {
    if (a.startMinute !== b.startMinute) {
      return a.startMinute - b.startMinute;
    }
    return a.endMinute - b.endMinute;
  });

  const rowEndMinutes: number[] = [];
  const placed: RowPlacedTimelineEvent[] = [];

  for (const event of sorted) {
    let row = rowEndMinutes.findIndex(rowEnd => rowEnd <= event.startMinute);
    if (row === -1) {
      row = rowEndMinutes.length;
      rowEndMinutes.push(event.endMinute);
    } else {
      rowEndMinutes[row] = event.endMinute;
    }

    placed.push({...event, row});
  }

  return {placed, rowCount: Math.max(1, rowEndMinutes.length)};
}

export function layoutVerticalEventsIntoColumns(events: TimelineEvent[]): {
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

  for (const event of sorted) {
    let col = colEndMinutes.findIndex(colEnd => colEnd <= event.startMinute);
    if (col === -1) {
      col = colEndMinutes.length;
      colEndMinutes.push(event.endMinute);
    } else {
      colEndMinutes[col] = event.endMinute;
    }

    placed.push({...event, row: col});
  }

  return {placed, columnCount: Math.max(1, colEndMinutes.length)};
}
