export type Priority = 1 | 2 | 3;

export type SyncState = 'synced' | 'pending' | 'retry' | 'terminal_local_only';

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
  actualDurationSeconds: number;
  actualDurationMinutes: number;
  completionXp: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastModifiedDeviceAt?: string;
  syncState?: SyncState;
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
