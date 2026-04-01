export type DateFormatPreference = 'us' | 'eu';
export type TimeFormatPreference = '12h' | '24h';
export type WeekStartPreference = 'sunday' | 'monday';

export type UserPreferences = {
  darkMode: boolean;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  weekStart: WeekStartPreference;
  defaultSnoozeMinutes: number;
};
