import {normalizeCategoryColor} from '@/types/category';
import type {Category} from '@/types/category';
import type {Habit, HabitCompletionRecord} from '@/types/habit';
import type {Note} from '@/types/note';
import type {SyncQueueItem} from './types';
import type {SyncState, Task} from '@/types/task';

const DB_KEY = 'dodo.web.localdb.v1';

export type LocalHabitCompletionRecord = HabitCompletionRecord & {
  completed: boolean;
  lastModifiedDeviceAt: string;
  syncState: SyncState;
};

type SyncStateRecord = {
  lastSyncAt: string | null;
  updatedAt: string;
};

type WebDb = {
  tasks: Record<string, Task[]>;
  categories: Record<string, Category[]>;
  habits: Record<string, Habit[]>;
  notes: Record<string, Note[]>;
  habitCompletions: Record<string, LocalHabitCompletionRecord[]>;
  syncQueues: Record<string, SyncQueueItem[]>;
  syncStates: Record<string, SyncStateRecord>;
};

let initialized = false;

function createDefaultDb(): WebDb {
  return {
    tasks: {},
    categories: {},
    habits: {},
    notes: {},
    habitCompletions: {},
    syncQueues: {},
    syncStates: {},
  };
}

function loadDb(): WebDb {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    return createDefaultDb();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WebDb>;
    return {
      tasks: parsed.tasks ?? {},
      categories: parsed.categories ?? {},
      habits: parsed.habits ?? {},
      notes: parsed.notes ?? {},
      habitCompletions: parsed.habitCompletions ?? {},
      syncQueues: parsed.syncQueues ?? {},
      syncStates: parsed.syncStates ?? {},
    };
  } catch {
    return createDefaultDb();
  }
}

function saveDb(db: WebDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function normalizeStoredColors(db: WebDb) {
  let changed = false;
  Object.keys(db.categories).forEach(userId => {
    db.categories[userId] = (db.categories[userId] ?? []).map(category => {
      const normalizedColor = normalizeCategoryColor(category.color);
      if (normalizedColor !== category.color) {
        changed = true;
        return {...category, color: normalizedColor};
      }
      return category;
    });
  });
  if (changed) {
    saveDb(db);
  }
}

export async function initializeLocalDb(): Promise<void> {
  if (initialized) {
    return;
  }
  const db = loadDb();
  normalizeStoredColors(db);
  initialized = true;
}

export async function readDb<T>(reader: (db: WebDb) => T): Promise<T> {
  await initializeLocalDb();
  return reader(loadDb());
}

export async function writeDb<T>(writer: (db: WebDb) => T): Promise<T> {
  await initializeLocalDb();
  const db = loadDb();
  const result = writer(db);
  saveDb(db);
  return result;
}

export async function purgeUserData(userId: string): Promise<void> {
  await writeDb(db => {
    delete db.tasks[userId];
    delete db.categories[userId];
    delete db.habits[userId];
    delete db.notes[userId];
    delete db.habitCompletions[userId];
    delete db.syncQueues[userId];
    delete db.syncStates[userId];
  });
}
