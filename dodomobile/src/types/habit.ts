export type HabitFrequency = "daily" | "weekly";

export type Habit = {
  id: string;
  title: string;
  frequency: HabitFrequency;
  startMinute?: number | null;
  durationMinutes?: number | null;
  createdAt: string;
};

export type CreateHabitInput = {
  title: string;
  frequency: HabitFrequency;
  startMinute?: number | null;
  durationMinutes?: number | null;
};
