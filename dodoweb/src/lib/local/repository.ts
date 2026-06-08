import {
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryColor,
  type Category,
  type CreateCategoryInput,
} from '@/types/category';
import type {
  CreateHabitInput,
  Habit,
  HabitCompletionRecord,
} from '@/types/habit';
import type {CreateNoteInput, Note, UpdateNoteInput} from '@/types/note';
import type {CreateTaskInput, Task} from '@/types/task';
import {calculateHabitStreaks} from '@/utils/habits';
import {readDb, writeDb, type LocalHabitCompletionRecord} from './db';
import {generateId, generateUuid, nowIso} from './id';
import type {SyncAction, SyncEntity, SyncQueueItem} from './types';

type QueuePayload = Record<string, unknown>;

const RETRY_DELAY_MS = 2 * 60 * 1000;

function safeTaskSeconds(
  seconds: number | null | undefined,
  minutes: number | null | undefined,
) {
  if (seconds != null && Number.isFinite(seconds)) {
    return Math.max(0, Math.floor(seconds));
  }
  return Math.max(0, Math.floor((minutes ?? 0) * 60));
}

function secondsToMinutes(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds === 0) {
    return 0;
  }
  return Math.ceil(safeSeconds / 60);
}

function elapsedTaskSeconds(startedAt: string | null | undefined, endedAtIso: string) {
  if (!startedAt) {
    return 0;
  }
  const startedAtMs = Date.parse(startedAt);
  const endedAtMs = Date.parse(endedAtIso);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));
}

function getPlannedTaskSeconds(
  task: Pick<Task, 'durationMinutes' | 'scheduledAt' | 'deadline'>,
) {
  if (
    task.durationMinutes != null &&
    Number.isFinite(task.durationMinutes) &&
    task.durationMinutes > 0
  ) {
    return Math.max(60, Math.round(task.durationMinutes * 60));
  }
  const scheduledAtMs = Date.parse(task.scheduledAt);
  const deadlineMs = Date.parse(task.deadline);
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(deadlineMs)) {
    return 60;
  }
  return Math.max(60, Math.floor((deadlineMs - scheduledAtMs) / 1000));
}

function ensureUserArray<T>(map: Record<string, T[]>, userId: string): T[] {
  if (!map[userId]) {
    map[userId] = [];
  }
  return map[userId];
}

function ensureUserSyncState(
  map: Record<string, {lastSyncAt: string | null; updatedAt: string}>,
  userId: string,
) {
  if (!map[userId]) {
    map[userId] = {lastSyncAt: null, updatedAt: nowIso()};
  }
  return map[userId];
}

function replaceById<T extends {id: string}>(items: T[], next: T): T[] {
  const index = items.findIndex(item => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }
  const copy = [...items];
  copy[index] = next;
  return copy;
}

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function recalculateHabitDerivedFields(
  userId: string,
  habitOrId: Habit | string,
): Promise<void> {
  await writeDb(db => {
    const habits = ensureUserArray(db.habits, userId);
    const habit =
      typeof habitOrId === 'string'
        ? habits.find(item => item.id === habitOrId) ?? null
        : habitOrId;
    if (!habit) {
      return;
    }

    const completions = ensureUserArray(db.habitCompletions, userId)
      .filter(row => row.habitId === habit.id && row.completed)
      .map(row => row.date);

    const streaks = calculateHabitStreaks(habit, completions, toDateKey(new Date()));
    const index = habits.findIndex(item => item.id === habit.id);
    if (index === -1) {
      return;
    }
    habits[index] = {
      ...habits[index],
      currentStreak: streaks.currentStreak,
      bestStreak: streaks.bestStreak,
      lastCompletedOn: streaks.lastCompletedOn,
      nextOccurrenceOn: streaks.nextOccurrenceOn,
    };
  });
}

async function enqueueSyncOp(params: {
  userId: string;
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: QueuePayload;
}) {
  await writeDb(db => {
    const queue = ensureUserArray(db.syncQueues, params.userId);
    const existing = queue.filter(
      op =>
        op.entity === params.entity &&
        op.entityId === params.entityId &&
        (op.status === 'pending' || op.status === 'retry'),
    );
    const hasCreate = existing.some(op => op.action === 'create');
    const isDelete = params.action === 'delete';

    if (hasCreate && isDelete) {
      db.syncQueues[params.userId] = queue.filter(
        op =>
          !(
            op.entity === params.entity &&
            op.entityId === params.entityId &&
            (op.status === 'pending' || op.status === 'retry')
          ),
      );
      return;
    }

    const filtered = queue.filter(
      op =>
        !(
          op.entity === params.entity &&
          op.entityId === params.entityId &&
          (op.status === 'pending' || op.status === 'retry')
        ),
    );

    filtered.push({
      id: generateId('op'),
      userId: params.userId,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      payload: JSON.stringify(params.payload),
      attempts: 0,
      nextRetryAt: nowIso(),
      status: 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    db.syncQueues[params.userId] = filtered;
  });
}

export async function listTasksLocal(
  userId: string,
  opts?: {startAt?: string; endAt?: string; categoryId?: string},
): Promise<Task[]> {
  return readDb(db =>
    ensureUserArray(db.tasks, userId)
      .filter(task => !task.deletedAt)
      .filter(task => (opts?.categoryId ? task.categoryId === opts.categoryId : true))
      .filter(task => (opts?.startAt ? task.scheduledAt >= opts.startAt : true))
      .filter(task => (opts?.endAt ? task.scheduledAt < opts.endAt : true))
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.deadline.localeCompare(b.deadline);
      }),
  );
}

export async function upsertTaskFromRemote(userId: string, task: Task): Promise<void> {
  await writeDb(db => {
    const tasks = ensureUserArray(db.tasks, userId);
    const now = nowIso();
    db.tasks[userId] = replaceById(tasks, {
      ...task,
      updatedAt: task.updatedAt ?? now,
      deletedAt: task.deletedAt ?? null,
      lastModifiedDeviceAt: now,
      syncState: 'synced',
    });
  });
}

export async function createTaskLocal(
  userId: string,
  input: CreateTaskInput,
): Promise<Task> {
  const now = nowIso();
  const task: Task = {
    id: generateUuid(),
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    scheduledAt: input.scheduledAt,
    deadline: input.deadline,
    durationMinutes: input.durationMinutes,
    priority: input.priority,
    completed: false,
    completedAt: null,
    timerStartedAt: null,
    actualDurationSeconds: 0,
    actualDurationMinutes: 0,
    completionXp: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await writeDb(db => {
    ensureUserArray(db.tasks, userId).push(task);
  });

  await enqueueSyncOp({
    userId,
    entity: 'task',
    entityId: task.id,
    action: 'create',
    payload: {id: task.id, ...input},
  });

  return task;
}

export async function updateTaskLocal(
  userId: string,
  taskId: string,
  updates: Partial<CreateTaskInput> & {
    completed?: boolean;
    timerStartedAt?: string | null;
    actualDurationSeconds?: number;
    actualDurationMinutes?: number;
  },
): Promise<Task | null> {
  let nextTask: Task | null = null;

  await writeDb(db => {
    const tasks = ensureUserArray(db.tasks, userId);
    const existingIndex = tasks.findIndex(task => task.id === taskId);
    if (existingIndex === -1) {
      return;
    }

    const existing = tasks[existingIndex];
    const now = nowIso();
    let actualDurationSeconds = safeTaskSeconds(
      updates.actualDurationSeconds,
      updates.actualDurationMinutes,
    );
    if (
      updates.actualDurationSeconds == null &&
      updates.actualDurationMinutes == null
    ) {
      actualDurationSeconds = existing.actualDurationSeconds;
    } else {
      actualDurationSeconds = Math.max(
        existing.actualDurationSeconds,
        actualDurationSeconds,
      );
    }

    const nextCompleted = updates.completed ?? existing.completed;
    let nextTimerStartedAt = existing.timerStartedAt;

    if (typeof updates.timerStartedAt !== 'undefined') {
      if (updates.timerStartedAt && !existing.completed && !nextCompleted) {
        nextTimerStartedAt = updates.timerStartedAt;
      } else if (nextTimerStartedAt) {
        if (
          updates.actualDurationSeconds == null &&
          updates.actualDurationMinutes == null
        ) {
          actualDurationSeconds += elapsedTaskSeconds(nextTimerStartedAt, now);
        }
        nextTimerStartedAt = null;
      } else {
        nextTimerStartedAt = null;
      }
    }

    if (updates.completed === true && !existing.completed) {
      if (nextTimerStartedAt) {
        if (
          updates.actualDurationSeconds == null &&
          updates.actualDurationMinutes == null
        ) {
          actualDurationSeconds += elapsedTaskSeconds(nextTimerStartedAt, now);
        }
        nextTimerStartedAt = null;
      }
      if (actualDurationSeconds <= 0) {
        actualDurationSeconds = getPlannedTaskSeconds(existing);
      }
    }

    nextTask = {
      ...existing,
      ...updates,
      completed: nextCompleted,
      completedAt:
        updates.completed === true
          ? !existing.completed
            ? now
            : existing.completedAt
          : updates.completed === false
          ? null
          : existing.completedAt,
      timerStartedAt: nextTimerStartedAt,
      actualDurationSeconds,
      actualDurationMinutes: secondsToMinutes(actualDurationSeconds),
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };

    tasks[existingIndex] = nextTask;
  });

  if (!nextTask) {
    return null;
  }
  const finalizedTask = nextTask as Task;

  const syncPayload: QueuePayload = {...updates};
  if (
    typeof updates.timerStartedAt !== 'undefined' ||
    typeof updates.completed !== 'undefined' ||
    typeof updates.actualDurationSeconds !== 'undefined' ||
    typeof updates.actualDurationMinutes !== 'undefined'
  ) {
    syncPayload.timerStartedAt = finalizedTask.timerStartedAt;
    syncPayload.actualDurationSeconds = finalizedTask.actualDurationSeconds;
    syncPayload.actualDurationMinutes = finalizedTask.actualDurationMinutes;
    syncPayload.completed = finalizedTask.completed;
  }

  await enqueueSyncOp({
    userId,
    entity: 'task',
    entityId: taskId,
    action: 'update',
    payload: syncPayload,
  });

  return finalizedTask;
}

export async function softDeleteTaskLocal(userId: string, taskId: string): Promise<void> {
  await writeDb(db => {
    const tasks = ensureUserArray(db.tasks, userId);
    const index = tasks.findIndex(task => task.id === taskId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    tasks[index] = {
      ...tasks[index],
      deletedAt: now,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
  });

  await enqueueSyncOp({
    userId,
    entity: 'task',
    entityId: taskId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteTaskLocal(userId: string, taskId: string): Promise<void> {
  await writeDb(db => {
    db.tasks[userId] = ensureUserArray(db.tasks, userId).filter(task => task.id !== taskId);
  });
}

export async function listNotesLocal(userId: string): Promise<Note[]> {
  return readDb(db =>
    ensureUserArray(db.notes, userId)
      .filter(note => !note.deletedAt)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        if (a.isPinned && b.isPinned) {
          return (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? '');
        }
        const aUpdated = a.updatedAt ?? a.createdAt;
        const bUpdated = b.updatedAt ?? b.createdAt;
        return bUpdated.localeCompare(aUpdated);
      }),
  );
}

export async function upsertNoteFromRemote(userId: string, note: Note): Promise<void> {
  await writeDb(db => {
    const notes = ensureUserArray(db.notes, userId);
    const now = nowIso();
    db.notes[userId] = replaceById(notes, {
      ...note,
      updatedAt: note.updatedAt ?? now,
      deletedAt: note.deletedAt ?? null,
      lastModifiedDeviceAt: now,
      syncState: 'synced',
    });
  });
}

export async function createNoteLocal(
  userId: string,
  input: CreateNoteInput,
): Promise<Note> {
  const now = nowIso();
  const isPinned = Boolean(input.isPinned);
  const note: Note = {
    id: generateUuid(),
    heading: input.heading ?? '',
    contentRich: input.contentRich ?? '',
    contentPlain: input.contentPlain ?? '',
    isPinned,
    pinnedAt: isPinned ? input.pinnedAt ?? now : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await writeDb(db => {
    ensureUserArray(db.notes, userId).push(note);
  });

  await enqueueSyncOp({
    userId,
    entity: 'note',
    entityId: note.id,
    action: 'create',
    payload: {
      id: note.id,
      heading: note.heading,
      contentRich: note.contentRich,
      contentPlain: note.contentPlain,
      isPinned: note.isPinned,
      pinnedAt: note.pinnedAt,
    },
  });

  return note;
}

export async function updateNoteLocal(
  userId: string,
  noteId: string,
  updates: UpdateNoteInput,
): Promise<Note | null> {
  let nextNote: Note | null = null;

  await writeDb(db => {
    const notes = ensureUserArray(db.notes, userId);
    const index = notes.findIndex(note => note.id === noteId);
    if (index === -1) {
      return;
    }
    const existing = notes[index];
    const now = nowIso();
    nextNote = {
      ...existing,
      ...updates,
      isPinned: updates.isPinned ?? existing.isPinned,
      pinnedAt:
        typeof updates.isPinned === 'boolean'
          ? updates.isPinned
            ? updates.pinnedAt ?? existing.pinnedAt ?? now
            : null
          : updates.pinnedAt ?? existing.pinnedAt,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
    notes[index] = nextNote;
  });

  if (!nextNote) {
    return null;
  }
  const finalizedNote = nextNote as Note;

  await enqueueSyncOp({
    userId,
    entity: 'note',
    entityId: noteId,
    action: 'update',
    payload: {
      ...updates,
      isPinned: finalizedNote.isPinned,
      pinnedAt: finalizedNote.pinnedAt,
    },
  });

  return finalizedNote;
}

export async function softDeleteNoteLocal(userId: string, noteId: string): Promise<void> {
  await writeDb(db => {
    const notes = ensureUserArray(db.notes, userId);
    const index = notes.findIndex(note => note.id === noteId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    notes[index] = {
      ...notes[index],
      deletedAt: now,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
  });

  await enqueueSyncOp({
    userId,
    entity: 'note',
    entityId: noteId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteNoteLocal(userId: string, noteId: string): Promise<void> {
  await writeDb(db => {
    db.notes[userId] = ensureUserArray(db.notes, userId).filter(note => note.id !== noteId);
  });
}

export async function listCategoriesLocal(userId: string): Promise<Category[]> {
  return readDb(db =>
    ensureUserArray(db.categories, userId)
      .filter(category => !category.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function upsertCategoryFromRemote(
  userId: string,
  category: Category,
): Promise<void> {
  await writeDb(db => {
    const categories = ensureUserArray(db.categories, userId);
    const now = nowIso();
    db.categories[userId] = replaceById(categories, {
      ...category,
      color: normalizeCategoryColor(category.color),
      icon: category.icon || DEFAULT_CATEGORY_ICON,
      updatedAt: category.updatedAt ?? now,
      deletedAt: category.deletedAt ?? null,
      lastModifiedDeviceAt: now,
      syncState: 'synced',
    });
  });
}

export async function createCategoryLocal(
  userId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const now = nowIso();
  const category: Category = {
    id: generateUuid(),
    name: input.name,
    color: normalizeCategoryColor(input.color),
    icon: input.icon || DEFAULT_CATEGORY_ICON,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await writeDb(db => {
    ensureUserArray(db.categories, userId).push(category);
  });

  await enqueueSyncOp({
    userId,
    entity: 'category',
    entityId: category.id,
    action: 'create',
    payload: {id: category.id, ...input, color: category.color, icon: category.icon},
  });

  return category;
}

export async function updateCategoryLocal(
  userId: string,
  categoryId: string,
  input: CreateCategoryInput,
): Promise<Category | null> {
  let nextCategory: Category | null = null;

  await writeDb(db => {
    const categories = ensureUserArray(db.categories, userId);
    const index = categories.findIndex(category => category.id === categoryId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    nextCategory = {
      ...categories[index],
      name: input.name,
      color: normalizeCategoryColor(input.color),
      icon: input.icon || DEFAULT_CATEGORY_ICON,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
    categories[index] = nextCategory;
  });

  if (!nextCategory) {
    return null;
  }
  const finalizedCategory = nextCategory as Category;

  await enqueueSyncOp({
    userId,
    entity: 'category',
    entityId: categoryId,
    action: 'update',
    payload: {
      ...input,
      color: finalizedCategory.color,
      icon: finalizedCategory.icon,
    },
  });

  return finalizedCategory;
}

export async function softDeleteCategoryLocal(
  userId: string,
  categoryId: string,
): Promise<void> {
  await writeDb(db => {
    const categories = ensureUserArray(db.categories, userId);
    const index = categories.findIndex(category => category.id === categoryId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    categories[index] = {
      ...categories[index],
      deletedAt: now,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
  });

  await enqueueSyncOp({
    userId,
    entity: 'category',
    entityId: categoryId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteCategoryLocal(
  userId: string,
  categoryId: string,
): Promise<void> {
  await writeDb(db => {
    db.categories[userId] = ensureUserArray(db.categories, userId).filter(
      category => category.id !== categoryId,
    );
  });
}

export async function listHabitsLocal(userId: string): Promise<Habit[]> {
  return readDb(db =>
    ensureUserArray(db.habits, userId)
      .filter(habit => !habit.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function upsertHabitFromRemote(userId: string, habit: Habit): Promise<void> {
  await writeDb(db => {
    const habits = ensureUserArray(db.habits, userId);
    const now = nowIso();
    db.habits[userId] = replaceById(habits, {
      ...habit,
      updatedAt: habit.updatedAt ?? now,
      deletedAt: habit.deletedAt ?? null,
      lastModifiedDeviceAt: now,
      syncState: 'synced',
    });
  });
}

export async function createHabitLocal(
  userId: string,
  input: CreateHabitInput,
): Promise<Habit> {
  const now = nowIso();
  const habit: Habit = {
    id: generateUuid(),
    title: input.title,
    icon: input.icon,
    frequencyType: input.frequencyType,
    intervalDays: input.intervalDays ?? null,
    customDays: input.customDays ?? [],
    timeMinute: input.timeMinute ?? null,
    durationMinutes: input.durationMinutes ?? null,
    anchorDate: input.anchorDate ?? now.slice(0, 10),
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedOn: null,
    nextOccurrenceOn: null,
    timerStartedAt: null,
    trackedSecondsToday: 0,
    isPaused: input.isPaused ?? false,
    pausedUntil: input.pausedUntil ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await writeDb(db => {
    ensureUserArray(db.habits, userId).push(habit);
  });

  await enqueueSyncOp({
    userId,
    entity: 'habit',
    entityId: habit.id,
    action: 'create',
    payload: {id: habit.id, ...input},
  });

  return habit;
}

export async function updateHabitLocal(
  userId: string,
  habitId: string,
  updates: Partial<CreateHabitInput>,
): Promise<Habit | null> {
  let nextHabit: Habit | null = null;

  await writeDb(db => {
    const habits = ensureUserArray(db.habits, userId);
    const index = habits.findIndex(habit => habit.id === habitId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    nextHabit = {
      ...habits[index],
      ...updates,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
    habits[index] = nextHabit;
  });

  if (!nextHabit) {
    return null;
  }

  await enqueueSyncOp({
    userId,
    entity: 'habit',
    entityId: habitId,
    action: 'update',
    payload: updates,
  });

  await recalculateHabitDerivedFields(userId, nextHabit);
  const [updated] = await readDb(db =>
    ensureUserArray(db.habits, userId).filter(habit => habit.id === habitId),
  );
  return updated ?? nextHabit;
}

export async function softDeleteHabitLocal(userId: string, habitId: string): Promise<void> {
  await writeDb(db => {
    const habits = ensureUserArray(db.habits, userId);
    const index = habits.findIndex(habit => habit.id === habitId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    habits[index] = {
      ...habits[index],
      deletedAt: now,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
  });

  await enqueueSyncOp({
    userId,
    entity: 'habit',
    entityId: habitId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteHabitLocal(userId: string, habitId: string): Promise<void> {
  await writeDb(db => {
    db.habits[userId] = ensureUserArray(db.habits, userId).filter(habit => habit.id !== habitId);
    db.habitCompletions[userId] = ensureUserArray(
      db.habitCompletions,
      userId,
    ).filter(row => row.habitId !== habitId);
  });
}

export async function upsertHabitHistoryFromRemote(
  userId: string,
  rows: HabitCompletionRecord[],
): Promise<void> {
  const affectedHabitIds = new Set<string>();

  await writeDb(db => {
    const completions = ensureUserArray(db.habitCompletions, userId);
    const now = nowIso();
    rows.forEach(row => {
      const nextRow: LocalHabitCompletionRecord = {
        habitId: row.habitId,
        date: row.date,
        completed: row.completed === false ? false : true,
        updatedAt: row.updatedAt ?? now,
        lastModifiedDeviceAt: now,
        syncState: 'synced',
      };
      const index = completions.findIndex(
        item => item.habitId === row.habitId && item.date === row.date,
      );
      if (index === -1) {
        completions.push(nextRow);
      } else {
        completions[index] = nextRow;
      }
      affectedHabitIds.add(row.habitId);
    });
  });

  for (const habitId of affectedHabitIds) {
    await recalculateHabitDerivedFields(userId, habitId);
  }
}

export async function listHabitCompletionMapLocal(
  userId: string,
  params?: {startDate?: string; endDate?: string; habitId?: string},
): Promise<Record<string, Record<string, boolean>>> {
  return readDb(db =>
    ensureUserArray(db.habitCompletions, userId)
      .filter(row => row.completed)
      .filter(row => (params?.habitId ? row.habitId === params.habitId : true))
      .filter(row => (params?.startDate ? row.date >= params.startDate : true))
      .filter(row => (params?.endDate ? row.date <= params.endDate : true))
      .reduce((acc, row) => {
        if (!acc[row.habitId]) {
          acc[row.habitId] = {};
        }
        acc[row.habitId][row.date] = true;
        return acc;
      }, {} as Record<string, Record<string, boolean>>),
  );
}

export async function setHabitCompletedLocal(params: {
  userId: string;
  habitId: string;
  date: string;
  completed: boolean;
}): Promise<void> {
  await writeDb(db => {
    const now = nowIso();
    const habits = ensureUserArray(db.habits, params.userId);
    const habitIndex = habits.findIndex(habit => habit.id === params.habitId);
    if (habitIndex !== -1 && params.completed) {
      const trackedSecondsToday = Math.max(0, habits[habitIndex].trackedSecondsToday ?? 0);
      if (trackedSecondsToday <= 0) {
        const plannedSeconds = Math.max(
          60,
          Math.max(1, Number(habits[habitIndex].durationMinutes) || 30) * 60,
        );
        habits[habitIndex] = {
          ...habits[habitIndex],
          trackedSecondsToday: plannedSeconds,
          updatedAt: now,
          lastModifiedDeviceAt: now,
          syncState: 'pending',
        };
      }
    }

    const completions = ensureUserArray(db.habitCompletions, params.userId);
    const nextRow: LocalHabitCompletionRecord = {
      habitId: params.habitId,
      date: params.date,
      completed: params.completed,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
    const index = completions.findIndex(
      row => row.habitId === params.habitId && row.date === params.date,
    );
    if (index === -1) {
      completions.push(nextRow);
    } else {
      completions[index] = nextRow;
    }
  });

  await enqueueSyncOp({
    userId: params.userId,
    entity: 'habit_completion',
    entityId: `${params.habitId}:${params.date}`,
    action: params.completed ? 'complete' : 'uncomplete',
    payload: {habitId: params.habitId, date: params.date},
  });

  await recalculateHabitDerivedFields(params.userId, params.habitId);
}

export async function setHabitTimerLocal(params: {
  userId: string;
  habitId: string;
  date?: string;
  startedAt: string | null;
  action: 'start_timer' | 'pause_timer';
}): Promise<void> {
  await writeDb(db => {
    const habits = ensureUserArray(db.habits, params.userId);
    const index = habits.findIndex(habit => habit.id === params.habitId);
    if (index === -1) {
      return;
    }
    const now = nowIso();
    habits[index] = {
      ...habits[index],
      timerStartedAt: params.startedAt,
      updatedAt: now,
      lastModifiedDeviceAt: now,
      syncState: 'pending',
    };
  });

  await enqueueSyncOp({
    userId: params.userId,
    entity: 'habit_timer',
    entityId: params.habitId,
    action: params.action,
    payload: {habitId: params.habitId, date: params.date},
  });
}

export async function getPendingQueueForSync(userId: string): Promise<SyncQueueItem[]> {
  return readDb(db => {
    const now = nowIso();
    return ensureUserArray(db.syncQueues, userId)
      .filter(op => (op.status === 'pending' || op.status === 'retry') && op.nextRetryAt <= now)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
}

export async function markQueueItemSynced(opId: string): Promise<void> {
  await writeDb(db => {
    Object.keys(db.syncQueues).forEach(userId => {
      db.syncQueues[userId] = ensureUserArray(db.syncQueues, userId).filter(
        op => op.id !== opId,
      );
    });
  });
}

export async function markQueueItemRetry(op: SyncQueueItem): Promise<void> {
  await writeDb(db => {
    const queue = ensureUserArray(db.syncQueues, op.userId);
    const index = queue.findIndex(item => item.id === op.id);
    if (index === -1) {
      return;
    }
    const attempts = Number(op.attempts ?? 0) + 1;
    queue[index] = {
      ...queue[index],
      attempts,
      nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
      status: attempts >= 5 ? 'terminal_local_only' : 'retry',
      updatedAt: nowIso(),
    };
  });
}

export async function markEntitySynced(
  userId: string,
  entity: SyncEntity,
  entityId: string,
): Promise<void> {
  await writeDb(db => {
    const now = nowIso();
    if (entity === 'task') {
      db.tasks[userId] = ensureUserArray(db.tasks, userId).map(task =>
        task.id === entityId ? {...task, syncState: 'synced', updatedAt: now} : task,
      );
      return;
    }
    if (entity === 'habit') {
      db.habits[userId] = ensureUserArray(db.habits, userId).map(habit =>
        habit.id === entityId ? {...habit, syncState: 'synced', updatedAt: now} : habit,
      );
      return;
    }
    if (entity === 'note') {
      db.notes[userId] = ensureUserArray(db.notes, userId).map(note =>
        note.id === entityId ? {...note, syncState: 'synced', updatedAt: now} : note,
      );
      return;
    }
    if (entity === 'category') {
      db.categories[userId] = ensureUserArray(db.categories, userId).map(category =>
        category.id === entityId
          ? {...category, syncState: 'synced', updatedAt: now}
          : category,
      );
      return;
    }
    if (entity === 'habit_completion') {
      const [habitId, date] = entityId.split(':');
      db.habitCompletions[userId] = ensureUserArray(
        db.habitCompletions,
        userId,
      ).map(row =>
        row.habitId === habitId && row.date === date
          ? {...row, syncState: 'synced', updatedAt: now}
          : row,
      );
    }
  });
}

export async function markEntityTerminal(
  userId: string,
  entity: SyncEntity,
  entityId: string,
): Promise<void> {
  await writeDb(db => {
    const now = nowIso();
    if (entity === 'task') {
      db.tasks[userId] = ensureUserArray(db.tasks, userId).map(task =>
        task.id === entityId
          ? {...task, syncState: 'terminal_local_only', updatedAt: now}
          : task,
      );
      return;
    }
    if (entity === 'habit') {
      db.habits[userId] = ensureUserArray(db.habits, userId).map(habit =>
        habit.id === entityId
          ? {...habit, syncState: 'terminal_local_only', updatedAt: now}
          : habit,
      );
      return;
    }
    if (entity === 'note') {
      db.notes[userId] = ensureUserArray(db.notes, userId).map(note =>
        note.id === entityId
          ? {...note, syncState: 'terminal_local_only', updatedAt: now}
          : note,
      );
      return;
    }
    if (entity === 'category') {
      db.categories[userId] = ensureUserArray(db.categories, userId).map(category =>
        category.id === entityId
          ? {...category, syncState: 'terminal_local_only', updatedAt: now}
          : category,
      );
      return;
    }
    if (entity === 'habit_completion') {
      const [habitId, date] = entityId.split(':');
      db.habitCompletions[userId] = ensureUserArray(
        db.habitCompletions,
        userId,
      ).map(row =>
        row.habitId === habitId && row.date === date
          ? {...row, syncState: 'terminal_local_only', updatedAt: now}
          : row,
      );
    }
  });
}

export async function setLastSyncAt(userId: string, at: string): Promise<void> {
  await writeDb(db => {
    const syncState = ensureUserSyncState(db.syncStates, userId);
    syncState.lastSyncAt = at;
    syncState.updatedAt = nowIso();
  });
}

export async function getLastSyncAt(userId: string): Promise<string | null> {
  return readDb(db => ensureUserSyncState(db.syncStates, userId).lastSyncAt ?? null);
}
