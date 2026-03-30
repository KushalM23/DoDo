import {
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryColor,
  type CreateCategoryInput,
  type Category,
} from '../../types/category';
import type {
  CreateHabitInput,
  Habit,
  HabitCompletionRecord,
} from '../../types/habit';
import type {CreateNoteInput, Note, UpdateNoteInput} from '../../types/note';
import type {CreateTaskInput, Task} from '../../types/task';
import {calculateHabitStreaks} from '../../utils/habits';
import {query, initializeLocalDb} from './db';
import {generateId, generateUuid, nowIso} from './id';
import type {SyncAction, SyncEntity, SyncQueueItem} from './types';

type QueuePayload = Record<string, unknown>;

const RETRY_DELAY_MS = 2 * 60 * 1000;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeTaskSeconds(
  seconds: number | null | undefined,
  minutes: number | null | undefined,
): number {
  if (seconds != null && Number.isFinite(seconds)) {
    return Math.max(0, Math.floor(seconds));
  }
  return Math.max(0, Math.floor((minutes ?? 0) * 60));
}

function secondsToMinutes(seconds: number): number {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds === 0) {
    return 0;
  }
  return Math.ceil(safeSeconds / 60);
}

function elapsedTaskSeconds(
  startedAt: string | null | undefined,
  endedAtIso: string,
): number {
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
): number {
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

function toTask(row: any): Task {
  const actualDurationSeconds = safeTaskSeconds(
    row.actual_duration_seconds,
    row.actual_duration_minutes,
  );

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    scheduledAt: row.scheduled_at,
    deadline: row.deadline,
    durationMinutes: row.duration_minutes,
    priority: row.priority,
    completed: Boolean(row.completed),
    completedAt: row.completed_at,
    timerStartedAt: row.timer_started_at,
    actualDurationSeconds,
    actualDurationMinutes:
      row.actual_duration_minutes ?? secondsToMinutes(actualDurationSeconds),
    completionXp: row.completion_xp ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    lastModifiedDeviceAt: row.last_modified_device_at,
    syncState: row.sync_state,
  };
}

function toCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: normalizeCategoryColor(row.color),
    icon: row.icon || DEFAULT_CATEGORY_ICON,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    lastModifiedDeviceAt: row.last_modified_device_at,
    syncState: row.sync_state,
  };
}

function toHabit(row: any): Habit {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    frequencyType: row.frequency_type,
    intervalDays: row.interval_days,
    customDays: parseJson<number[]>(row.custom_days_json, []),
    timeMinute: row.time_minute,
    durationMinutes: row.duration_minutes,
    anchorDate: row.anchor_date,
    currentStreak: row.current_streak ?? 0,
    bestStreak: row.best_streak ?? 0,
    lastCompletedOn: row.last_completed_on,
    nextOccurrenceOn: row.next_occurrence_on,
    timerStartedAt: row.timer_started_at,
    trackedSecondsToday: row.tracked_seconds_today ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    lastModifiedDeviceAt: row.last_modified_device_at,
    syncState: row.sync_state,
  };
}

function toNote(row: any): Note {
  return {
    id: row.id,
    heading: row.heading,
    contentRich: row.content_rich,
    contentPlain: row.content_plain,
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    lastModifiedDeviceAt: row.last_modified_device_at,
    syncState: row.sync_state,
  };
}

function toSyncQueueItem(row: any): SyncQueueItem {
  return {
    id: row.id,
    userId: row.user_id,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    payload: row.payload_json,
    attempts: row.attempts ?? 0,
    nextRetryAt: row.next_retry_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function recalculateHabitDerivedFields(
  userId: string,
  habitOrId: Habit | string,
): Promise<void> {
  await initializeLocalDb();

  const habit =
    typeof habitOrId === 'string'
      ? await query<any>(
          'SELECT * FROM habits_local WHERE user_id = ? AND id = ? LIMIT 1',
          [userId, habitOrId],
        ).then(rows => (rows[0] ? toHabit(rows[0]) : null))
      : habitOrId;

  if (!habit) {
    return;
  }

  const rows = await query<{completed_on: string}>(
    `SELECT completed_on
     FROM habit_completions_local
     WHERE user_id = ? AND habit_id = ? AND completed = 1`,
    [userId, habit.id],
  );

  const streaks = calculateHabitStreaks(
    habit,
    rows.map(row => row.completed_on),
    toDateKey(new Date()),
  );

  await query(
    `UPDATE habits_local
     SET current_streak = ?,
         best_streak = ?,
         last_completed_on = ?,
         next_occurrence_on = ?
     WHERE user_id = ? AND id = ?`,
    [
      streaks.currentStreak,
      streaks.bestStreak,
      streaks.lastCompletedOn,
      streaks.nextOccurrenceOn,
      userId,
      habit.id,
    ],
  );
}

async function enqueueSyncOp(params: {
  userId: string;
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: QueuePayload;
}): Promise<void> {
  await initializeLocalDb();
  const timestamp = nowIso();

  const existingRows = await query<any>(
    `SELECT * FROM sync_queue
     WHERE user_id = ?
       AND entity = ?
       AND entity_id = ?
       AND status IN ('pending', 'retry')
     ORDER BY created_at ASC`,
    [params.userId, params.entity, params.entityId],
  );
  const existing = existingRows.map(toSyncQueueItem);

  const hasCreate = existing.some(op => op.action === 'create');
  const isDelete = params.action === 'delete';

  if (hasCreate && isDelete) {
    await query(
      `DELETE FROM sync_queue
       WHERE user_id = ? AND entity = ? AND entity_id = ? AND status IN ('pending', 'retry')`,
      [params.userId, params.entity, params.entityId],
    );
    return;
  }

  if (existing.length > 0) {
    await query(
      `DELETE FROM sync_queue
       WHERE user_id = ? AND entity = ? AND entity_id = ? AND status IN ('pending', 'retry')`,
      [params.userId, params.entity, params.entityId],
    );
  }

  const id = generateId('op');
  await query(
    `INSERT INTO sync_queue (
      id, user_id, entity, entity_id, action, payload_json,
      attempts, next_retry_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)`,
    [
      id,
      params.userId,
      params.entity,
      params.entityId,
      params.action,
      JSON.stringify(params.payload),
      timestamp,
      timestamp,
      timestamp,
    ],
  );
}

export async function listTasksLocal(
  userId: string,
  opts?: {startAt?: string; endAt?: string; categoryId?: string},
): Promise<Task[]> {
  await initializeLocalDb();

  const where = ['user_id = ?', 'deleted_at IS NULL'];
  const args: unknown[] = [userId];

  if (opts?.categoryId) {
    where.push('category_id = ?');
    args.push(opts.categoryId);
  }
  if (opts?.startAt) {
    where.push('scheduled_at >= ?');
    args.push(opts.startAt);
  }
  if (opts?.endAt) {
    where.push('scheduled_at < ?');
    args.push(opts.endAt);
  }

  const rows = await query<any>(
    `SELECT * FROM tasks_local WHERE ${where.join(' AND ')}
     ORDER BY completed ASC, priority DESC, deadline ASC`,
    args,
  );
  return rows.map(toTask);
}

export async function upsertTaskFromRemote(
  userId: string,
  task: Task,
): Promise<void> {
  await initializeLocalDb();
  const now = nowIso();
  await query(
    `INSERT OR REPLACE INTO tasks_local (
      id, user_id, title, description, category_id, scheduled_at, deadline,
      duration_minutes, priority, completed, completed_at, timer_started_at,
      actual_duration_seconds, actual_duration_minutes, completion_xp, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      userId,
      task.title,
      task.description,
      task.categoryId,
      task.scheduledAt,
      task.deadline,
      task.durationMinutes,
      task.priority,
      task.completed ? 1 : 0,
      task.completedAt,
      task.timerStartedAt,
      task.actualDurationSeconds,
      task.actualDurationMinutes,
      task.completionXp,
      task.createdAt,
      task.updatedAt ?? now,
      task.deletedAt ?? null,
      now,
      'synced',
    ],
  );
}

export async function createTaskLocal(
  userId: string,
  input: CreateTaskInput,
): Promise<Task> {
  await initializeLocalDb();
  const now = nowIso();
  const id = generateUuid();
  const task: Task = {
    id,
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

  await query(
    `INSERT INTO tasks_local (
      id, user_id, title, description, category_id, scheduled_at, deadline,
      duration_minutes, priority, completed, completed_at, timer_started_at,
      actual_duration_seconds, actual_duration_minutes, completion_xp, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      userId,
      task.title,
      task.description,
      task.categoryId,
      task.scheduledAt,
      task.deadline,
      task.durationMinutes,
      task.priority,
      task.completed ? 1 : 0,
      task.completedAt,
      task.timerStartedAt,
      task.actualDurationSeconds,
      task.actualDurationMinutes,
      task.completionXp,
      task.createdAt,
      task.updatedAt,
      null,
      task.lastModifiedDeviceAt,
      task.syncState,
    ],
  );

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
  const existingRows = await query<any>(
    'SELECT * FROM tasks_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, taskId],
  );
  if (existingRows.length === 0) {
    return null;
  }

  const existing = toTask(existingRows[0]);
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

  const next: Task = {
    ...existing,
    ...updates,
    completed: nextCompleted,
    completedAt:
      updates.completed === true
        ? updates.completed && !existing.completed
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

  await query(
    `UPDATE tasks_local SET
      title = ?,
      description = ?,
      category_id = ?,
      scheduled_at = ?,
      deadline = ?,
      duration_minutes = ?,
      priority = ?,
      completed = ?,
      completed_at = ?,
      timer_started_at = ?,
      actual_duration_seconds = ?,
      actual_duration_minutes = ?,
      updated_at = ?,
      last_modified_device_at = ?,
      sync_state = 'pending'
    WHERE user_id = ? AND id = ?`,
    [
      next.title,
      next.description,
      next.categoryId,
      next.scheduledAt,
      next.deadline,
      next.durationMinutes,
      next.priority,
      next.completed ? 1 : 0,
      next.completedAt,
      next.timerStartedAt,
      next.actualDurationSeconds,
      next.actualDurationMinutes,
      next.updatedAt,
      next.lastModifiedDeviceAt,
      userId,
      taskId,
    ],
  );

  const syncPayload: QueuePayload = {...updates};
  if (
    typeof updates.timerStartedAt !== 'undefined' ||
    typeof updates.completed !== 'undefined' ||
    typeof updates.actualDurationSeconds !== 'undefined' ||
    typeof updates.actualDurationMinutes !== 'undefined'
  ) {
    syncPayload.timerStartedAt = next.timerStartedAt;
    syncPayload.actualDurationSeconds = next.actualDurationSeconds;
    syncPayload.actualDurationMinutes = next.actualDurationMinutes;
    syncPayload.completed = next.completed;
  }

  await enqueueSyncOp({
    userId,
    entity: 'task',
    entityId: taskId,
    action: 'update',
    payload: syncPayload,
  });

  return next;
}

export async function softDeleteTaskLocal(
  userId: string,
  taskId: string,
): Promise<void> {
  const now = nowIso();
  await query(
    `UPDATE tasks_local SET
      deleted_at = ?,
      updated_at = ?,
      last_modified_device_at = ?,
      sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [now, now, now, userId, taskId],
  );

  await enqueueSyncOp({
    userId,
    entity: 'task',
    entityId: taskId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteTaskLocal(
  userId: string,
  taskId: string,
): Promise<void> {
  await query('DELETE FROM tasks_local WHERE user_id = ? AND id = ?', [
    userId,
    taskId,
  ]);
}

export async function listNotesLocal(userId: string): Promise<Note[]> {
  await initializeLocalDb();
  const rows = await query<any>(
    `SELECT * FROM notes_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY
       is_pinned DESC,
       CASE WHEN is_pinned = 1 THEN pinned_at END DESC,
       CASE WHEN is_pinned = 0 THEN updated_at END DESC`,
    [userId],
  );
  return rows.map(toNote);
}

export async function upsertNoteFromRemote(
  userId: string,
  note: Note,
): Promise<void> {
  await initializeLocalDb();
  const now = nowIso();
  await query(
    `INSERT OR REPLACE INTO notes_local (
      id, user_id, heading, content_rich, content_plain,
      is_pinned, pinned_at, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [
      note.id,
      userId,
      note.heading,
      note.contentRich,
      note.contentPlain,
      note.isPinned ? 1 : 0,
      note.pinnedAt ?? null,
      note.createdAt,
      note.updatedAt ?? now,
      note.deletedAt ?? null,
      now,
    ],
  );
}

export async function createNoteLocal(
  userId: string,
  input: CreateNoteInput,
): Promise<Note> {
  await initializeLocalDb();
  const now = nowIso();
  const id = generateUuid();
  const isPinned = Boolean(input.isPinned);
  const note: Note = {
    id,
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

  await query(
    `INSERT INTO notes_local (
      id, user_id, heading, content_rich, content_plain,
      is_pinned, pinned_at, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      userId,
      note.heading,
      note.contentRich,
      note.contentPlain,
      note.isPinned ? 1 : 0,
      note.pinnedAt,
      note.createdAt,
      note.updatedAt,
      note.deletedAt,
      note.lastModifiedDeviceAt,
      note.syncState,
    ],
  );

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
  await initializeLocalDb();
  const existingRows = await query<any>(
    'SELECT * FROM notes_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, noteId],
  );
  if (existingRows.length === 0) {
    return null;
  }

  const existing = toNote(existingRows[0]);
  const now = nowIso();

  let nextPinnedAt = existing.pinnedAt;
  if (typeof updates.isPinned === 'boolean') {
    if (updates.isPinned) {
      nextPinnedAt = updates.pinnedAt ?? existing.pinnedAt ?? now;
    } else {
      nextPinnedAt = null;
    }
  } else if (typeof updates.pinnedAt !== 'undefined') {
    nextPinnedAt = updates.pinnedAt;
  }

  const next: Note = {
    ...existing,
    ...updates,
    pinnedAt: nextPinnedAt,
    updatedAt: now,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await query(
    `UPDATE notes_local SET
      heading = ?,
      content_rich = ?,
      content_plain = ?,
      is_pinned = ?,
      pinned_at = ?,
      updated_at = ?,
      last_modified_device_at = ?,
      sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [
      next.heading,
      next.contentRich,
      next.contentPlain,
      next.isPinned ? 1 : 0,
      next.pinnedAt,
      next.updatedAt,
      next.lastModifiedDeviceAt,
      userId,
      noteId,
    ],
  );

  await enqueueSyncOp({
    userId,
    entity: 'note',
    entityId: noteId,
    action: 'update',
    payload: {
      ...updates,
      isPinned: next.isPinned,
      pinnedAt: next.pinnedAt,
    } as QueuePayload,
  });

  return next;
}

export async function softDeleteNoteLocal(
  userId: string,
  noteId: string,
): Promise<void> {
  await initializeLocalDb();
  const now = nowIso();
  await query(
    `UPDATE notes_local
     SET deleted_at = ?, updated_at = ?, last_modified_device_at = ?, sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [now, now, now, userId, noteId],
  );

  await enqueueSyncOp({
    userId,
    entity: 'note',
    entityId: noteId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteNoteLocal(
  userId: string,
  noteId: string,
): Promise<void> {
  await initializeLocalDb();
  await query('DELETE FROM notes_local WHERE user_id = ? AND id = ?', [
    userId,
    noteId,
  ]);
}

export async function listCategoriesLocal(userId: string): Promise<Category[]> {
  const rows = await query<any>(
    `SELECT * FROM categories_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(toCategory);
}

export async function upsertCategoryFromRemote(
  userId: string,
  category: Category,
): Promise<void> {
  const now = nowIso();
  const color = normalizeCategoryColor(category.color);
  await query(
    `INSERT OR REPLACE INTO categories_local (
      id, user_id, name, color, icon, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [
      category.id,
      userId,
      category.name,
      color,
      category.icon || DEFAULT_CATEGORY_ICON,
      category.createdAt,
      category.updatedAt ?? now,
      category.deletedAt ?? null,
      now,
    ],
  );
}

export async function createCategoryLocal(
  userId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const now = nowIso();
  const color = normalizeCategoryColor(input.color);
  const category: Category = {
    id: generateUuid(),
    name: input.name,
    color,
    icon: input.icon || DEFAULT_CATEGORY_ICON,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await query(
    `INSERT INTO categories_local (
      id, user_id, name, color, icon, created_at, updated_at, deleted_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category.id,
      userId,
      category.name,
      category.color,
      category.icon,
      category.createdAt,
      category.updatedAt,
      null,
      category.lastModifiedDeviceAt,
      category.syncState,
    ],
  );

  await enqueueSyncOp({
    userId,
    entity: 'category',
    entityId: category.id,
    action: 'create',
    payload: {
      id: category.id,
      ...input,
      color,
      icon: input.icon || DEFAULT_CATEGORY_ICON,
    },
  });

  return category;
}

export async function updateCategoryLocal(
  userId: string,
  categoryId: string,
  input: CreateCategoryInput,
): Promise<Category | null> {
  const existing = await query<any>(
    'SELECT * FROM categories_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, categoryId],
  );
  if (existing.length === 0) {
    return null;
  }

  const now = nowIso();
  const color = normalizeCategoryColor(input.color);
  await query(
    `UPDATE categories_local
     SET name = ?, color = ?, icon = ?, updated_at = ?,
         last_modified_device_at = ?, sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [
      input.name,
      color,
      input.icon || DEFAULT_CATEGORY_ICON,
      now,
      now,
      userId,
      categoryId,
    ],
  );

  await enqueueSyncOp({
    userId,
    entity: 'category',
    entityId: categoryId,
    action: 'update',
    payload: {...input, color, icon: input.icon || DEFAULT_CATEGORY_ICON},
  });

  const [row] = await query<any>(
    'SELECT * FROM categories_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, categoryId],
  );
  return row ? toCategory(row) : null;
}

export async function softDeleteCategoryLocal(
  userId: string,
  categoryId: string,
): Promise<void> {
  const now = nowIso();
  await query(
    `UPDATE categories_local
     SET deleted_at = ?, updated_at = ?, last_modified_device_at = ?, sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [now, now, now, userId, categoryId],
  );

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
  await query('DELETE FROM categories_local WHERE user_id = ? AND id = ?', [
    userId,
    categoryId,
  ]);
}

export async function listHabitsLocal(userId: string): Promise<Habit[]> {
  const rows = await query<any>(
    `SELECT * FROM habits_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(toHabit);
}

export async function upsertHabitFromRemote(
  userId: string,
  habit: Habit,
): Promise<void> {
  const now = nowIso();
  await query(
    `INSERT OR REPLACE INTO habits_local (
      id, user_id, title, icon, frequency_type, interval_days, custom_days_json,
      time_minute, duration_minutes, anchor_date, current_streak, best_streak,
      last_completed_on, next_occurrence_on, timer_started_at, tracked_seconds_today,
      created_at, updated_at, deleted_at, last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [
      habit.id,
      userId,
      habit.title,
      habit.icon,
      habit.frequencyType,
      habit.intervalDays,
      JSON.stringify(habit.customDays ?? []),
      habit.timeMinute,
      habit.durationMinutes,
      habit.anchorDate,
      habit.currentStreak,
      habit.bestStreak,
      habit.lastCompletedOn,
      habit.nextOccurrenceOn,
      habit.timerStartedAt,
      habit.trackedSecondsToday,
      habit.createdAt,
      habit.updatedAt ?? now,
      habit.deletedAt ?? null,
      now,
    ],
  );
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
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await query(
    `INSERT INTO habits_local (
      id, user_id, title, icon, frequency_type, interval_days, custom_days_json,
      time_minute, duration_minutes, anchor_date, current_streak, best_streak,
      last_completed_on, next_occurrence_on, timer_started_at, tracked_seconds_today,
      created_at, updated_at, deleted_at, last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.id,
      userId,
      habit.title,
      habit.icon,
      habit.frequencyType,
      habit.intervalDays,
      JSON.stringify(habit.customDays),
      habit.timeMinute,
      habit.durationMinutes,
      habit.anchorDate,
      habit.currentStreak,
      habit.bestStreak,
      habit.lastCompletedOn,
      habit.nextOccurrenceOn,
      habit.timerStartedAt,
      habit.trackedSecondsToday,
      habit.createdAt,
      habit.updatedAt,
      null,
      habit.lastModifiedDeviceAt,
      habit.syncState,
    ],
  );

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
  const existing = await query<any>(
    'SELECT * FROM habits_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, habitId],
  );
  if (existing.length === 0) {
    return null;
  }

  const before = toHabit(existing[0]);
  const now = nowIso();
  const next: Habit = {
    ...before,
    ...updates,
    updatedAt: now,
    lastModifiedDeviceAt: now,
    syncState: 'pending',
  };

  await query(
    `UPDATE habits_local SET
      title = ?,
      icon = ?,
      frequency_type = ?,
      interval_days = ?,
      custom_days_json = ?,
      time_minute = ?,
      duration_minutes = ?,
      anchor_date = ?,
      timer_started_at = ?,
      updated_at = ?,
      last_modified_device_at = ?,
      sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [
      next.title,
      next.icon,
      next.frequencyType,
      next.intervalDays,
      JSON.stringify(next.customDays ?? []),
      next.timeMinute,
      next.durationMinutes,
      next.anchorDate,
      next.timerStartedAt,
      next.updatedAt,
      next.lastModifiedDeviceAt,
      userId,
      habitId,
    ],
  );

  await enqueueSyncOp({
    userId,
    entity: 'habit',
    entityId: habitId,
    action: 'update',
    payload: updates as QueuePayload,
  });

  await recalculateHabitDerivedFields(userId, next);

  const [row] = await query<any>(
    'SELECT * FROM habits_local WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, habitId],
  );
  return row ? toHabit(row) : next;
}

export async function softDeleteHabitLocal(
  userId: string,
  habitId: string,
): Promise<void> {
  const now = nowIso();
  await query(
    `UPDATE habits_local
     SET deleted_at = ?, updated_at = ?, last_modified_device_at = ?, sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [now, now, now, userId, habitId],
  );

  await enqueueSyncOp({
    userId,
    entity: 'habit',
    entityId: habitId,
    action: 'delete',
    payload: {},
  });
}

export async function hardDeleteHabitLocal(
  userId: string,
  habitId: string,
): Promise<void> {
  await query('DELETE FROM habits_local WHERE user_id = ? AND id = ?', [
    userId,
    habitId,
  ]);
  await query(
    'DELETE FROM habit_completions_local WHERE user_id = ? AND habit_id = ?',
    [userId, habitId],
  );
}

export async function upsertHabitHistoryFromRemote(
  userId: string,
  rows: HabitCompletionRecord[],
): Promise<void> {
  const now = nowIso();
  const affectedHabitIds = new Set<string>();
  for (const row of rows) {
    await query(
      `INSERT OR REPLACE INTO habit_completions_local (
        habit_id, user_id, completed_on, completed, updated_at,
        last_modified_device_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, 'synced')`,
      [
        row.habitId,
        userId,
        row.date,
        row.completed === false ? 0 : 1,
        row.updatedAt ?? now,
        now,
      ],
    );
    affectedHabitIds.add(row.habitId);
  }

  for (const habitId of affectedHabitIds) {
    await recalculateHabitDerivedFields(userId, habitId);
  }
}

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function listHabitCompletionMapLocal(
  userId: string,
  params?: {startDate?: string; endDate?: string; habitId?: string},
): Promise<Record<string, Record<string, boolean>>> {
  const where = ['user_id = ?', 'completed = 1'];
  const args: unknown[] = [userId];
  if (params?.habitId) {
    where.push('habit_id = ?');
    args.push(params.habitId);
  }
  if (params?.startDate) {
    where.push('completed_on >= ?');
    args.push(params.startDate);
  }
  if (params?.endDate) {
    where.push('completed_on <= ?');
    args.push(params.endDate);
  }

  const rows = await query<any>(
    `SELECT habit_id, completed_on
     FROM habit_completions_local
     WHERE ${where.join(' AND ')}`,
    args,
  );

  return rows.reduce((acc, row) => {
    const habitId = String(row.habit_id);
    const date = String(row.completed_on);
    if (!acc[habitId]) {
      acc[habitId] = {};
    }
    acc[habitId][date] = true;
    return acc;
  }, {} as Record<string, Record<string, boolean>>);
}

export async function setHabitCompletedLocal(params: {
  userId: string;
  habitId: string;
  date: string;
  completed: boolean;
}): Promise<void> {
  const now = nowIso();
  if (params.completed) {
    const existingHabitRows = await query<any>(
      'SELECT duration_minutes, tracked_seconds_today FROM habits_local WHERE user_id = ? AND id = ? LIMIT 1',
      [params.userId, params.habitId],
    );
    const existingHabit = existingHabitRows[0];
    if (existingHabit) {
      const trackedSecondsToday = Math.max(
        0,
        Number(existingHabit.tracked_seconds_today) || 0,
      );
      if (trackedSecondsToday <= 0) {
        const plannedSeconds = Math.max(
          60,
          Math.max(1, Number(existingHabit.duration_minutes) || 30) * 60,
        );
        await query(
          `UPDATE habits_local
           SET tracked_seconds_today = ?, updated_at = ?, last_modified_device_at = ?, sync_state = 'pending'
           WHERE user_id = ? AND id = ?`,
          [plannedSeconds, now, now, params.userId, params.habitId],
        );
      }
    }
  }

  await query(
    `INSERT OR REPLACE INTO habit_completions_local (
      habit_id, user_id, completed_on, completed, updated_at,
      last_modified_device_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      params.habitId,
      params.userId,
      params.date,
      params.completed ? 1 : 0,
      now,
      now,
    ],
  );

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
  const now = nowIso();
  await query(
    `UPDATE habits_local
     SET timer_started_at = ?, updated_at = ?, last_modified_device_at = ?, sync_state = 'pending'
     WHERE user_id = ? AND id = ?`,
    [params.startedAt, now, now, params.userId, params.habitId],
  );

  await enqueueSyncOp({
    userId: params.userId,
    entity: 'habit_timer',
    entityId: params.habitId,
    action: params.action,
    payload: {habitId: params.habitId, date: params.date},
  });
}

export async function getPendingQueueForSync(
  userId: string,
): Promise<SyncQueueItem[]> {
  const now = nowIso();
  const rows = await query<any>(
    `SELECT * FROM sync_queue
     WHERE user_id = ?
       AND status IN ('pending', 'retry')
       AND next_retry_at <= ?
     ORDER BY created_at ASC`,
    [userId, now],
  );
  return rows.map(toSyncQueueItem);
}

export async function markQueueItemSynced(opId: string): Promise<void> {
  await query('DELETE FROM sync_queue WHERE id = ?', [opId]);
}

export async function markQueueItemRetry(op: SyncQueueItem): Promise<void> {
  const attempts = Number(op.attempts ?? 0) + 1;
  const now = nowIso();
  const nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
  const terminal = attempts >= 5;

  await query(
    `UPDATE sync_queue
     SET attempts = ?,
         next_retry_at = ?,
         status = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      attempts,
      nextRetryAt,
      terminal ? 'terminal_local_only' : 'retry',
      now,
      op.id,
    ],
  );
}

export async function markEntitySynced(
  userId: string,
  entity: SyncEntity,
  entityId: string,
): Promise<void> {
  const now = nowIso();
  if (entity === 'task') {
    await query(
      `UPDATE tasks_local SET sync_state = 'synced', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'habit') {
    await query(
      `UPDATE habits_local SET sync_state = 'synced', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'note') {
    await query(
      `UPDATE notes_local SET sync_state = 'synced', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'category') {
    await query(
      `UPDATE categories_local SET sync_state = 'synced', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'habit_completion') {
    const [habitId, date] = entityId.split(':');
    await query(
      `UPDATE habit_completions_local SET sync_state = 'synced', updated_at = ?
       WHERE user_id = ? AND habit_id = ? AND completed_on = ?`,
      [now, userId, habitId, date],
    );
  }
}

export async function markEntityTerminal(
  userId: string,
  entity: SyncEntity,
  entityId: string,
): Promise<void> {
  const now = nowIso();
  if (entity === 'task') {
    await query(
      `UPDATE tasks_local SET sync_state = 'terminal_local_only', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'habit') {
    await query(
      `UPDATE habits_local SET sync_state = 'terminal_local_only', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'note') {
    await query(
      `UPDATE notes_local SET sync_state = 'terminal_local_only', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'category') {
    await query(
      `UPDATE categories_local SET sync_state = 'terminal_local_only', updated_at = ?
       WHERE user_id = ? AND id = ?`,
      [now, userId, entityId],
    );
    return;
  }
  if (entity === 'habit_completion') {
    const [habitId, date] = entityId.split(':');
    await query(
      `UPDATE habit_completions_local SET sync_state = 'terminal_local_only', updated_at = ?
       WHERE user_id = ? AND habit_id = ? AND completed_on = ?`,
      [now, userId, habitId, date],
    );
  }
}

export async function setLastSyncAt(userId: string, at: string): Promise<void> {
  await query(
    `INSERT OR REPLACE INTO sync_state (user_id, last_sync_at, updated_at)
     VALUES (?, ?, ?)`,
    [userId, at, nowIso()],
  );
}

export async function getLastSyncAt(userId: string): Promise<string | null> {
  const rows = await query<{last_sync_at: string | null}>(
    'SELECT last_sync_at FROM sync_state WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return rows[0]?.last_sync_at ?? null;
}
