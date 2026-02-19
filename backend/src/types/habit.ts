export type HabitFrequency = "daily" | "weekly";

export type HabitRow = {
  id: string;
  user_id: string;
  title: string;
  frequency: HabitFrequency;
  created_at: string;
};

export type HabitDto = {
  id: string;
  title: string;
  frequency: HabitFrequency;
  createdAt: string;
};

export function toHabitDto(row: HabitRow): HabitDto {
  return {
    id: row.id,
    title: row.title,
    frequency: row.frequency,
    createdAt: row.created_at,
  };
}
