import { toLocalDateKey } from "@/utils/dateTime";

const TASK_DAY_WINDOW = 240;
const CALENDAR_MONTH_WINDOW = 60;

const TASK_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TASK_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type TaskDateWheelItem = {
  key: string;
  label: string;
  date: Date;
};

export type CalendarMonthWheelItem = {
  key: string;
  label: string;
  date: Date;
  month: number;
  year: number;
};

export type CalendarMonthSelection = {
  currentDate: Date;
  selectedDate: string;
};

export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatOrdinalDay(day: number): string {
  const remainder = day % 10;
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) {
    return `${day}th`;
  }
  if (remainder === 1) {
    return `${day}st`;
  }
  if (remainder === 2) {
    return `${day}nd`;
  }
  if (remainder === 3) {
    return `${day}rd`;
  }
  return `${day}th`;
}

export function formatTaskWheelDayDate(value: Date): string {
  return `${TASK_WEEKDAY_LABELS[value.getDay()]}, ${formatOrdinalDay(
    value.getDate(),
  )} ${TASK_MONTH_LABELS[value.getMonth()]}`;
}

export function formatTaskTriggerLabel(value: string | Date): string {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  return formatTaskWheelDayDate(date);
}

export function formatCalendarTriggerLabel(value: Date): string {
  return `${TASK_MONTH_LABELS[value.getMonth()]} ${value.getFullYear()}`;
}

export function buildTaskDateItems(centerDate: Date): TaskDateWheelItem[] {
  const center = startOfLocalDay(centerDate);
  return Array.from({ length: TASK_DAY_WINDOW * 2 + 1 }, (_, index) => {
    const offset = index - TASK_DAY_WINDOW;
    const date = new Date(
      center.getFullYear(),
      center.getMonth(),
      center.getDate() + offset,
    );
    return {
      key: toLocalDateKey(date),
      label: formatTaskWheelDayDate(date),
      date,
    };
  });
}

export function findDateIndex(
  items: Array<{ key: string }>,
  targetKey: string,
  fallbackIndex = Math.floor(items.length / 2),
): number {
  const index = items.findIndex((item) => item.key === targetKey);
  return index >= 0 ? index : fallbackIndex;
}

export function findTaskDateIndex(
  items: TaskDateWheelItem[],
  targetDate: Date,
): number {
  return findDateIndex(
    items,
    toLocalDateKey(targetDate),
    Math.floor(items.length / 2),
  );
}

export function buildCalendarMonthItems(
  centerDate: Date,
): CalendarMonthWheelItem[] {
  const center = new Date(centerDate.getFullYear(), centerDate.getMonth(), 1);
  return Array.from({ length: CALENDAR_MONTH_WINDOW * 2 + 1 }, (_, index) => {
    const offset = index - CALENDAR_MONTH_WINDOW;
    const date = new Date(center.getFullYear(), center.getMonth() + offset, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}`,
      label: formatCalendarTriggerLabel(date),
      date,
      month: date.getMonth(),
      year: date.getFullYear(),
    };
  });
}

export function findCalendarMonthIndex(
  items: CalendarMonthWheelItem[],
  targetDate: Date,
): number {
  return findDateIndex(
    items,
    `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(
      2,
      "0",
    )}`,
    Math.floor(items.length / 2),
  );
}

export function resolveCalendarMonthSelection(
  targetMonth: number,
  targetYear: number,
): CalendarMonthSelection {
  const today = startOfLocalDay(new Date());
  const targetMonthDate = new Date(targetYear, targetMonth, 1);
  const isTodayMonth =
    targetMonthDate.getMonth() === today.getMonth() &&
    targetMonthDate.getFullYear() === today.getFullYear();
  const nextDate = isTodayMonth ? today : targetMonthDate;

  return {
    currentDate: nextDate,
    selectedDate: toLocalDateKey(nextDate),
  };
}

export function shiftCalendarMonth(
  currentDate: Date,
  delta: number,
): CalendarMonthSelection {
  const targetMonthDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + delta,
    1,
  );
  return resolveCalendarMonthSelection(
    targetMonthDate.getMonth(),
    targetMonthDate.getFullYear(),
  );
}
