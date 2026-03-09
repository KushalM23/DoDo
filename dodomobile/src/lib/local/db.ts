import {open, type QuickSQLiteConnection} from 'react-native-quick-sqlite';

const DB_NAME = 'dodo_local.db';
let db: QuickSQLiteConnection | null = null;
let initialized = false;

const LEGACY_CATEGORY_COLOR_MIGRATIONS = [
  ['#A855F7', '#F97316'],
  ['#8B5CF6', '#0EA5E9'],
  ['#6366F1', '#3B82F6'],
  ['#E8651A', '#14B8A6'],
  ['#D85A12', '#14B8A6'],
  ['#30A46C', '#10B981'],
  ['#F5A623', '#F59E0B'],
] as const;

function getDb(): QuickSQLiteConnection {
  if (!db) {
    db = open({name: DB_NAME});
  }
  return db;
}

async function exec(sql: string, params: unknown[] = []): Promise<void> {
  await getDb().executeAsync(sql, params);
}

export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getDb().executeAsync(sql, params);
  return (result.rows?._array ?? []) as T[];
}

export async function runInTransaction(
  fn: (tx: QuickSQLiteConnection) => Promise<void>,
): Promise<void> {
  const conn = getDb();
  await conn.executeAsync('BEGIN TRANSACTION');
  try {
    await fn(conn);
    await conn.executeAsync('COMMIT');
  } catch (error) {
    await conn.executeAsync('ROLLBACK');
    throw error;
  }
}

export async function initializeLocalDb(): Promise<void> {
  if (initialized) {
    return;
  }

  await exec('PRAGMA journal_mode = WAL');
  await exec('PRAGMA foreign_keys = ON');

  await exec(`
    CREATE TABLE IF NOT EXISTS tasks_local (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id TEXT,
      scheduled_at TEXT NOT NULL,
      deadline TEXT NOT NULL,
      duration_minutes INTEGER,
      priority INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      timer_started_at TEXT,
      actual_duration_minutes INTEGER NOT NULL DEFAULT 0,
      completion_xp INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      last_modified_device_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (id, user_id)
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS categories_local (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      last_modified_device_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (id, user_id)
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS habits_local (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      icon TEXT NOT NULL,
      frequency_type TEXT NOT NULL,
      interval_days INTEGER,
      custom_days_json TEXT NOT NULL,
      time_minute INTEGER,
      duration_minutes INTEGER,
      anchor_date TEXT,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_completed_on TEXT,
      next_occurrence_on TEXT,
      timer_started_at TEXT,
      tracked_seconds_today INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      last_modified_device_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (id, user_id)
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS habit_completions_local (
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      completed_on TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      last_modified_device_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (habit_id, user_id, completed_on)
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      user_id TEXT PRIMARY KEY,
      last_sync_at TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  await exec('CREATE INDEX IF NOT EXISTS idx_tasks_local_user_schedule ON tasks_local(user_id, scheduled_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_tasks_local_user_deleted ON tasks_local(user_id, deleted_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_categories_local_user_deleted ON categories_local(user_id, deleted_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_habits_local_user_deleted ON habits_local(user_id, deleted_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_habit_completions_local_user_date ON habit_completions_local(user_id, completed_on)');
  await exec('CREATE INDEX IF NOT EXISTS idx_sync_queue_schedule ON sync_queue(user_id, status, next_retry_at, created_at)');

  for (const [fromColor, toColor] of LEGACY_CATEGORY_COLOR_MIGRATIONS) {
    await exec(
      'UPDATE categories_local SET color = ? WHERE color = ?',
      [toColor, fromColor],
    );
    await exec(
      `UPDATE sync_queue
       SET payload_json = REPLACE(payload_json, ?, ?)
       WHERE entity = 'category' AND payload_json LIKE ?`,
      [fromColor, toColor, `%${fromColor}%`],
    );
  }

  initialized = true;
}

export async function purgeUserData(userId: string): Promise<void> {
  await initializeLocalDb();
  await runInTransaction(async tx => {
    await tx.executeAsync('DELETE FROM tasks_local WHERE user_id = ?', [userId]);
    await tx.executeAsync('DELETE FROM categories_local WHERE user_id = ?', [userId]);
    await tx.executeAsync('DELETE FROM habits_local WHERE user_id = ?', [userId]);
    await tx.executeAsync('DELETE FROM habit_completions_local WHERE user_id = ?', [userId]);
    await tx.executeAsync('DELETE FROM sync_queue WHERE user_id = ?', [userId]);
    await tx.executeAsync('DELETE FROM sync_state WHERE user_id = ?', [userId]);
  });
}
