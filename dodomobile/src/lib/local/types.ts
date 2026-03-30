export type SyncState = 'synced' | 'pending' | 'retry' | 'terminal_local_only';

export type SyncEntity =
  | 'task'
  | 'habit'
  | 'category'
  | 'habit_completion'
  | 'habit_timer';

export type SyncAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'complete'
  | 'uncomplete'
  | 'start_timer'
  | 'pause_timer';

export type SyncQueueItem = {
  id: string;
  userId: string;
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: string;
  attempts: number;
  nextRetryAt: string;
  status: SyncState;
  createdAt: string;
  updatedAt: string;
};
