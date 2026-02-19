export type Priority = 1 | 2 | 3;

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  scheduled_at: string;
  deadline: string;
  duration_minutes: number | null;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  timer_started_at: string | null;
  created_at: string;
};

export type TaskDto = {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  scheduledAt: string;
  deadline: string;
  durationMinutes: number | null;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  timerStartedAt: string | null;
  createdAt: string;
};

export function toTaskDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    categoryId: row.category_id,
    scheduledAt: row.scheduled_at,
    deadline: row.deadline,
    durationMinutes: row.duration_minutes,
    priority: row.priority,
    completed: row.completed,
    completedAt: row.completed_at,
    timerStartedAt: row.timer_started_at,
    createdAt: row.created_at,
  };
}

