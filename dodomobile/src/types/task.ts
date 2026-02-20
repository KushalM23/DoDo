export type Priority = 1 | 2 | 3;

export type Task = {
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
  actualDurationMinutes: number;
  completionXp: number;
  createdAt: string;
};

export type CreateTaskInput = {
  title: string;
  description: string;
  categoryId: string | null;
  scheduledAt: string;
  deadline: string;
  durationMinutes: number | null;
  priority: Priority;
};
