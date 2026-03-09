import type { TimeFormatPreference } from "../state/PreferencesContext";
import type { Habit } from "../types/habit";
import { formatTime } from "./dateTime";

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function weekdaySunFirst(date: Date): number {
  return date.getDay();
}

export function habitAppliesToDate(habit: Habit, dateKey: string): boolean {
  const target = parseDateKey(dateKey);
  const anchorSource = habit.anchorDate ? `${habit.anchorDate}T00:00:00` : habit.createdAt;
  const anchor = anchorSource ? new Date(anchorSource) : target;
  anchor.setHours(0, 0, 0, 0);
  if (target < anchor) return false;

  if (habit.frequencyType === "daily") return true;

  if (habit.frequencyType === "interval") {
    if (!habit.intervalDays) return false;
    const diffDays = Math.floor((target.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays % habit.intervalDays === 0;
  }

  if (!habit.customDays.length) return false;
  return habit.customDays.includes(weekdaySunFirst(target));
}

export function buildHabitTrackerDateKeys(
  habit: Habit,
  referenceDateKey: string,
  limit = 49,
): string[] {
  const anchorSource = habit.anchorDate ? `${habit.anchorDate}T00:00:00` : habit.createdAt;
  const anchor = anchorSource ? new Date(anchorSource) : parseDateKey(referenceDateKey);
  anchor.setHours(0, 0, 0, 0);

  const cursor = parseDateKey(referenceDateKey);
  cursor.setHours(0, 0, 0, 0);

  if (cursor < anchor) {
    return [];
  }

  const pastApplicableDates: string[] = [];
  let guard = 0;

  while (pastApplicableDates.length < limit && cursor >= anchor && guard < 5000) {
    const key = toDateKey(cursor);
    if (habitAppliesToDate(habit, key)) {
      pastApplicableDates.push(key);
    }
    cursor.setDate(cursor.getDate() - 1);
    guard += 1;
  }

  const startKey = pastApplicableDates[pastApplicableDates.length - 1];
  if (!startKey) {
    return [];
  }

  const trackerDates: string[] = [];
  const forwardCursor = parseDateKey(startKey);
  guard = 0;

  while (trackerDates.length < limit && guard < 5000) {
    const key = toDateKey(forwardCursor);
    if (habitAppliesToDate(habit, key)) {
      trackerDates.push(key);
    }
    forwardCursor.setDate(forwardCursor.getDate() + 1);
    guard += 1;
  }

  return trackerDates;
}

export function calculateHabitStreaks(
  habit: Habit,
  completedDateKeys: string[],
  referenceDateKey: string,
): {
  currentStreak: number;
  bestStreak: number;
  lastCompletedOn: string | null;
  nextOccurrenceOn: string | null;
} {
  const completedSet = new Set(completedDateKeys);
  const anchorSource = habit.anchorDate ? `${habit.anchorDate}T00:00:00` : habit.createdAt;
  const anchor = anchorSource ? new Date(anchorSource) : parseDateKey(referenceDateKey);
  anchor.setHours(0, 0, 0, 0);

  const referenceDate = parseDateKey(referenceDateKey);
  referenceDate.setHours(0, 0, 0, 0);

  if (referenceDate < anchor) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedOn: null,
      nextOccurrenceOn: referenceDateKey,
    };
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;
  let lastCompletedOn: string | null = null;

  const cursor = new Date(anchor);
  let latestApplicableKey: string | null = null;
  let guard = 0;

  while (cursor <= referenceDate && guard < 10000) {
    const key = toDateKey(cursor);
    if (habitAppliesToDate(habit, key)) {
      latestApplicableKey = key;
      if (completedSet.has(key)) {
        runningStreak += 1;
        bestStreak = Math.max(bestStreak, runningStreak);
        lastCompletedOn = key;
      } else {
        runningStreak = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  if (latestApplicableKey && completedSet.has(latestApplicableKey)) {
    const streakCursor = parseDateKey(latestApplicableKey);
    guard = 0;
    while (streakCursor >= anchor && guard < 10000) {
      const key = toDateKey(streakCursor);
      if (!habitAppliesToDate(habit, key)) {
        streakCursor.setDate(streakCursor.getDate() - 1);
        guard += 1;
        continue;
      }
      if (!completedSet.has(key)) {
        break;
      }
      currentStreak += 1;
      streakCursor.setDate(streakCursor.getDate() - 1);
      guard += 1;
    }
  }

  const nextOccurrenceCursor = new Date(referenceDate);
  nextOccurrenceCursor.setDate(nextOccurrenceCursor.getDate() + 1);
  let nextOccurrenceOn: string | null = null;
  guard = 0;

  while (guard < 10000) {
    const key = toDateKey(nextOccurrenceCursor);
    if (habitAppliesToDate(habit, key)) {
      nextOccurrenceOn = key;
      break;
    }
    nextOccurrenceCursor.setDate(nextOccurrenceCursor.getDate() + 1);
    guard += 1;
  }

  return {
    currentStreak,
    bestStreak,
    lastCompletedOn,
    nextOccurrenceOn,
  };
}

export function formatHabitFrequency(habit: Habit): string {
  if (habit.frequencyType === "daily") return "Every day";
  if (habit.frequencyType === "interval") return `Every ${habit.intervalDays ?? "?"} days`;

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [...habit.customDays].sort((a, b) => a - b).map((d) => labels[d]).join(", ");
  return days.length > 0 ? days : "Custom";
}

export function minuteToIso(dateKey: string, minute: number): string {
  const date = parseDateKey(dateKey);
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  date.setHours(hours, mins, 0, 0);
  return date.toISOString();
}

export function minuteToLabel(minute: number | null | undefined, timeFormat: TimeFormatPreference): string {
  if (minute == null) return "Any time";
  const date = new Date();
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return formatTime(date, timeFormat);
}
