import type { TimeFormatPreference } from "../state/PreferencesContext";
import type { Habit } from "../types/habit";
import { formatTime } from "./dateTime";

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function weekdaySunFirst(date: Date): number {
  return date.getDay();
}

export function habitAppliesToDate(habit: Habit, dateKey: string): boolean {
  if (habit.frequencyType === "daily") return true;

  const target = parseDateKey(dateKey);

  if (habit.frequencyType === "interval") {
    if (!habit.intervalDays) return false;
    const anchor = habit.createdAt ? new Date(habit.createdAt) : target;
    anchor.setHours(0, 0, 0, 0);
    if (target < anchor) return false;
    const diffDays = Math.floor((target.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays % habit.intervalDays === 0;
  }

  if (!habit.customDays.length) return false;
  return habit.customDays.includes(weekdaySunFirst(target));
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
