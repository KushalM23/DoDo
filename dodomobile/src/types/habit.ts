export type HabitFrequencyType = "daily" | "interval" | "custom_days";

export type HabitIcon =
  | "book-open"
  | "dumbbell"
  | "droplets"
  | "utensils"
  | "bed"
  | "target"
  | "brain"
  | "leaf"
  | "music"
  | "cup-soda";

export const HABIT_ICON_OPTIONS: HabitIcon[] = [
  "book-open",
  "dumbbell",
  "droplets",
  "utensils",
  "bed",
  "target",
  "brain",
  "leaf",
  "music",
  "cup-soda",
];

export const DEFAULT_HABIT_ICON: HabitIcon = "target";

export type Habit = {
  id: string;
  title: string;
  icon: HabitIcon;
  frequencyType: HabitFrequencyType;
  intervalDays: number | null;
  customDays: number[];
  timeMinute: number | null;
  durationMinutes: number | null;
  anchorDate: string | null;
  currentStreak: number;
  bestStreak: number;
  lastCompletedOn: string | null;
  nextOccurrenceOn: string | null;
  timerStartedAt: string | null;
  trackedSecondsToday: number;
  createdAt: string;
};

export type CreateHabitInput = {
  title: string;
  icon: HabitIcon;
  anchorDate?: string | null;
  frequencyType: HabitFrequencyType;
  intervalDays?: number | null;
  customDays?: number[];
  timeMinute?: number | null;
  durationMinutes?: number | null;
};

export type HabitCompletionRecord = {
  habitId: string;
  date: string;
};
