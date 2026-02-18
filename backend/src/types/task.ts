export type Priority = 1 | 2 | 3;

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  deadline: string;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type TaskDto = {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  deadline: string;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
};

export function toTaskDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    scheduledAt: row.scheduled_at,
    deadline: row.deadline,
    priority: row.priority,
    completed: row.completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

