import type { DateFormatPreference, TimeFormatPreference, WeekStartPreference } from "../state/PreferencesContext";

type DateTimePrefs = {
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  weekStart: WeekStartPreference;
};

const DAY_LABELS_SUN_FIRST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toLocalDateKey(value: string | Date): string {
  const d = toDate(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDate(value: string | Date, dateFormat: DateFormatPreference, includeYear = true): string {
  const d = toDate(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();

  if (dateFormat === "eu") {
    return includeYear ? `${dd}/${mm}/${yyyy}` : `${dd}/${mm}`;
  }

  return includeYear ? `${mm}/${dd}/${yyyy}` : `${mm}/${dd}`;
}

export function formatTime(value: string | Date, timeFormat: TimeFormatPreference): string {
  const d = toDate(value);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");

  if (timeFormat === "24h") {
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatDateTime(value: string | Date, prefs: DateTimePrefs): string {
  const d = toDate(value);
  return `${formatDate(d, prefs.dateFormat)} ${formatTime(d, prefs.timeFormat)}`;
}

export function getWeekdayLabels(weekStart: WeekStartPreference): string[] {
  if (weekStart === "monday") {
    return [...DAY_LABELS_SUN_FIRST.slice(1), DAY_LABELS_SUN_FIRST[0]];
  }
  return DAY_LABELS_SUN_FIRST;
}

export function getWeekdayInitials(weekStart: WeekStartPreference): string[] {
  return getWeekdayLabels(weekStart).map((d) => d[0]);
}

export function getCalendarOffset(dayOfWeekSunFirst: number, weekStart: WeekStartPreference): number {
  if (weekStart === "monday") {
    return (dayOfWeekSunFirst + 6) % 7;
  }
  return dayOfWeekSunFirst;
}
