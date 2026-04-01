import type {SyncState} from './task';

export type HabitFrequencyType = 'daily' | 'interval' | 'custom_days';

export type HabitIcon =
  | 'briefcase'
  | 'heart'
  | 'user'
  | 'book-open'
  | 'dumbbell'
  | 'droplets'
  | 'utensils'
  | 'bed'
  | 'brain'
  | 'music'
  | 'sun'
  | 'moon'
  | 'coffee'
  | 'shopping-cart';

export const HABIT_ICON_OPTIONS: HabitIcon[] = [
  'briefcase',
  'heart',
  'user',
  'book-open',
  'dumbbell',
  'droplets',
  'utensils',
  'bed',
  'brain',
  'music',
  'coffee',
  'shopping-cart',
];

export const DEFAULT_HABIT_ICON: HabitIcon = 'book-open';

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
  updatedAt?: string;
  deletedAt?: string | null;
  lastModifiedDeviceAt?: string;
  syncState?: SyncState;
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
  completed?: boolean;
  updatedAt?: string | null;
};
