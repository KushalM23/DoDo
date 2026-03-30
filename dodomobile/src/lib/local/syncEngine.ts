import {
  completeHabit,
  createCategory,
  createHabit,
  createNote,
  createTask,
  deleteCategory,
  deleteHabit,
  deleteNote,
  deleteTask,
  fetchSyncPull,
  pauseHabitTimer,
  startHabitTimer,
  uncompleteHabit,
  updateCategory,
  updateHabit,
  updateNote,
  updateTask,
} from '../../services/api';
import {
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryColor,
  type Category,
  type CreateCategoryInput,
} from '../../types/category';
import type {
  CreateHabitInput,
  Habit,
  HabitCompletionRecord,
} from '../../types/habit';
import type {CreateNoteInput, Note, UpdateNoteInput} from '../../types/note';
import type {CreateTaskInput, Task} from '../../types/task';
import {initializeLocalDb} from './db';
import {
  getLastSyncAt,
  getPendingQueueForSync,
  hardDeleteCategoryLocal,
  hardDeleteHabitLocal,
  hardDeleteNoteLocal,
  hardDeleteTaskLocal,
  markEntitySynced,
  markEntityTerminal,
  markQueueItemRetry,
  markQueueItemSynced,
  setLastSyncAt,
  upsertCategoryFromRemote,
  upsertHabitFromRemote,
  upsertHabitHistoryFromRemote,
  upsertNoteFromRemote,
  upsertTaskFromRemote,
} from './repository';
import type {SyncQueueItem} from './types';

type RunSyncReason =
  | 'startup'
  | 'periodic'
  | 'foreground'
  | 'logout'
  | 'manual';

let activeSync: Promise<boolean> | null = null;
let rerunRequested = false;

function asTaskCreate(payload: unknown): CreateTaskInput {
  return payload as CreateTaskInput;
}

function asTaskUpdate(payload: unknown): Partial<CreateTaskInput> & {
  completed?: boolean;
  timerStartedAt?: string | null;
  actualDurationSeconds?: number;
  actualDurationMinutes?: number;
} {
  return payload as Partial<CreateTaskInput> & {
    completed?: boolean;
    timerStartedAt?: string | null;
    actualDurationSeconds?: number;
    actualDurationMinutes?: number;
  };
}

function asCategoryCreate(payload: unknown): CreateCategoryInput {
  const category = payload as CreateCategoryInput;
  return {
    ...category,
    color: normalizeCategoryColor(category?.color),
    icon: category?.icon || DEFAULT_CATEGORY_ICON,
  };
}

function asHabitCreate(payload: unknown): CreateHabitInput {
  return payload as CreateHabitInput;
}

function asNoteCreate(payload: unknown): CreateNoteInput {
  return payload as CreateNoteInput;
}

function asNoteUpdate(payload: unknown): UpdateNoteInput {
  return payload as UpdateNoteInput;
}

async function pushOperation(userId: string, op: SyncQueueItem): Promise<void> {
  const payload = JSON.parse(op.payload || '{}');

  if (op.entity === 'task') {
    if (op.action === 'create') {
      const created = await createTask(asTaskCreate(payload));
      await upsertTaskFromRemote(userId, created);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'update') {
      const updated = await updateTask(op.entityId, asTaskUpdate(payload));
      await upsertTaskFromRemote(userId, updated);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'delete') {
      await deleteTask(op.entityId);
      await hardDeleteTaskLocal(userId, op.entityId);
      return;
    }
  }

  if (op.entity === 'category') {
    if (op.action === 'create') {
      const created = await createCategory(asCategoryCreate(payload));
      await upsertCategoryFromRemote(userId, created);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'update') {
      const updated = await updateCategory(
        op.entityId,
        asCategoryCreate(payload),
      );
      await upsertCategoryFromRemote(userId, updated);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'delete') {
      await deleteCategory(op.entityId);
      await hardDeleteCategoryLocal(userId, op.entityId);
      return;
    }
  }

  if (op.entity === 'habit') {
    if (op.action === 'create') {
      const created = await createHabit(asHabitCreate(payload));
      await upsertHabitFromRemote(userId, created);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'update') {
      const updated = await updateHabit(
        op.entityId,
        payload as Partial<CreateHabitInput>,
      );
      await upsertHabitFromRemote(userId, updated);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'delete') {
      await deleteHabit(op.entityId);
      await hardDeleteHabitLocal(userId, op.entityId);
      return;
    }
  }

  if (op.entity === 'note') {
    if (op.action === 'create') {
      const created = await createNote(asNoteCreate(payload));
      await upsertNoteFromRemote(userId, created);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'update') {
      const updated = await updateNote(op.entityId, asNoteUpdate(payload));
      await upsertNoteFromRemote(userId, updated);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'delete') {
      await deleteNote(op.entityId);
      await hardDeleteNoteLocal(userId, op.entityId);
      return;
    }
  }

  if (op.entity === 'habit_completion') {
    const {habitId, date} = payload as {habitId: string; date: string};
    if (op.action === 'complete') {
      const result = await completeHabit(habitId, date);
      await upsertHabitFromRemote(userId, result.habit);
      await upsertHabitHistoryFromRemote(userId, [result.completion]);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
    if (op.action === 'uncomplete') {
      const result = await uncompleteHabit(habitId, date);
      await upsertHabitFromRemote(userId, result.habit);
      await upsertHabitHistoryFromRemote(userId, [result.completion]);
      await markEntitySynced(userId, op.entity, op.entityId);
      return;
    }
  }

  if (op.entity === 'habit_timer') {
    const {habitId, date} = payload as {habitId: string; date?: string};
    if (op.action === 'start_timer') {
      const updated = await startHabitTimer(habitId, date);
      await upsertHabitFromRemote(userId, updated);
      await markEntitySynced(userId, 'habit', habitId);
      return;
    }
    if (op.action === 'pause_timer') {
      const updated = await pauseHabitTimer(habitId, date);
      await upsertHabitFromRemote(userId, updated);
      await markEntitySynced(userId, 'habit', habitId);
      return;
    }
  }
}

function syncStateEntity(op: SyncQueueItem) {
  return op.entity === 'habit_timer' ? 'habit' : op.entity;
}

async function pushQueue(userId: string): Promise<boolean> {
  const ops = await getPendingQueueForSync(userId);
  for (const op of ops) {
    try {
      await pushOperation(userId, op);
      await markQueueItemSynced(op.id);
    } catch (error) {
      await markQueueItemRetry(op);
      if ((op.attempts ?? 0) + 1 >= 5) {
        await markEntityTerminal(userId, syncStateEntity(op), op.entityId);
      }
      return false;
    }
  }
  return true;
}

async function pullRemote(userId: string): Promise<void> {
  const lastSyncAt = await getLastSyncAt(userId);
  const snapshot = await fetchSyncPull(lastSyncAt);

  for (const task of snapshot.tasks) {
    await upsertTaskFromRemote(userId, task as Task);
  }
  for (const category of snapshot.categories) {
    await upsertCategoryFromRemote(userId, category as Category);
  }
  for (const habit of snapshot.habits) {
    await upsertHabitFromRemote(userId, habit as Habit);
  }
  for (const note of snapshot.notes) {
    await upsertNoteFromRemote(userId, note as Note);
  }

  await upsertHabitHistoryFromRemote(
    userId,
    snapshot.habitCompletions as HabitCompletionRecord[],
  );
  await setLastSyncAt(userId, snapshot.serverTime);
}

export async function runSync(
  userId: string,
  _reason: RunSyncReason,
): Promise<boolean> {
  await initializeLocalDb();
  if (activeSync) {
    rerunRequested = true;
    return activeSync;
  }

  activeSync = (async () => {
    let overallOk = true;

    try {
      do {
        rerunRequested = false;

        const pushOk = await pushQueue(userId);
        overallOk = overallOk && pushOk;

        if (rerunRequested) {
          continue;
        }

        if (pushOk) {
          await pullRemote(userId);
        }
      } while (rerunRequested);

      return overallOk;
    } finally {
      activeSync = null;
    }
  })();

  return activeSync;
}

export async function runFinalSyncForLogout(userId: string): Promise<boolean> {
  const timeout = new Promise<boolean>(resolve => {
    setTimeout(() => resolve(false), 30_000);
  });
  const sync = runSync(userId, 'logout');
  return Promise.race([timeout, sync]);
}
