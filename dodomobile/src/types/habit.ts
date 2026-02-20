export type HabitFrequencyType = "daily" | "interval" | "custom_days";

export type Habit = {
  id: string;
  title: string;
  frequencyType: HabitFrequencyType;
  intervalDays: number | null;
  customDays: number[];
  timeMinute: number | null;
  durationMinutes: number | null;
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
