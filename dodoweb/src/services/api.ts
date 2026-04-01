import {env} from '@/config/env';
import type {AuthUser} from '@/types/auth';
import type {CreateTaskInput, Task} from '@/types/task';
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

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type SessionRefreshHandler = (
  session: {token: string; refreshToken: string} | null,
) => Promise<void>;

export type PushPlatform = 'android' | 'ios' | 'web';

export type UpsertPushTokenInput = {
  token: string;
  platform: PushPlatform;
  deviceId?: string;
  appVersion?: string;
};

export type HabitCompletionMutationResponse = {
  habit: Habit;
  completion: HabitCompletionRecord;
};

export type SyncPullResponse = {
  tasks: Task[];
  categories: Category[];
  habits: Habit[];
  notes: Note[];
  habitCompletions: HabitCompletionRecord[];
  serverTime: string;
};

let authToken: string | null = null;
let authRefreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionRefreshHandler: SessionRefreshHandler | null = null;

export function setSessionRefreshHandler(handler: SessionRefreshHandler | null) {
  sessionRefreshHandler = handler;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setAuthSession(
  session: {token: string; refreshToken: string} | null,
) {
  authToken = session?.token ?? null;
  authRefreshToken = session?.refreshToken ?? null;
}

async function performTokenRefresh(): Promise<string | null> {
  if (!authRefreshToken) {
    return null;
  }
  try {
    const refreshed = await refreshAuthSession(authRefreshToken);
    if (!refreshed.token || !refreshed.refreshToken) {
      return null;
    }
    setAuthSession(refreshed);
    if (sessionRefreshHandler) {
      await sessionRefreshHandler(refreshed);
    }
    return refreshed.token;
  } catch {
    setAuthSession(null);
    if (sessionRefreshHandler) {
      await sessionRefreshHandler(null);
    }
    return null;
  }
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!authRefreshToken) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function apiRequest<T>(
  path: string,
  method: ApiMethod,
  body?: object,
  requiresAuth = true,
  hasRetried = false,
): Promise<T> {
  const tokenUsed = authToken;
  if (requiresAuth && !tokenUsed) {
    throw new Error('You are not logged in.');
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokenUsed ? {Authorization: `Bearer ${tokenUsed}`} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data = {} as T & {error?: string};
  if (text) {
    try {
      data = JSON.parse(text) as T & {error?: string};
    } catch {
      throw new Error('Server returned an invalid response.');
    }
  }

  if (!response.ok) {
    if (response.status === 401 && requiresAuth && !hasRetried) {
      if (authToken !== tokenUsed) {
        return apiRequest<T>(path, method, body, requiresAuth, true);
      }
      const refreshedToken = await tryRefreshAccessToken();
      if (refreshedToken) {
        return apiRequest<T>(path, method, body, requiresAuth, true);
      }
      if (sessionRefreshHandler) {
        await sessionRefreshHandler(null);
      }
    }
    throw new Error(data.error ?? 'Request failed');
  }

  return data;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<{user: AuthUser; token: string; refreshToken: string}> {
  return apiRequest(
    '/auth/register',
    'POST',
    {email: email.trim(), password, displayName: displayName.trim()},
    false,
  );
}

export async function login(
  email: string,
  password: string,
): Promise<{user: AuthUser; token: string; refreshToken: string}> {
  return apiRequest('/auth/login', 'POST', {email: email.trim(), password}, false);
}

export async function refreshAuthSession(
  refreshToken: string,
): Promise<{token: string; refreshToken: string}> {
  return apiRequest('/auth/refresh', 'POST', {refreshToken}, false);
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await apiRequest<{user: AuthUser}>('/auth/me', 'GET');
  return data.user;
}

export async function changePassword(newPassword: string): Promise<void> {
  await apiRequest<void>('/auth/change-password', 'POST', {newPassword});
}

export async function deleteAccount(): Promise<void> {
  await apiRequest<void>('/auth/delete-account', 'DELETE');
}

export async function createTask(
  input: CreateTaskInput & {id?: string},
): Promise<Task> {
  const data = await apiRequest<{task: Task}>('/tasks', 'POST', input);
  return data.task;
}

export async function updateTask(
  taskId: string,
  updates: Partial<CreateTaskInput> & {
    completed?: boolean;
    timerStartedAt?: string | null;
    actualDurationSeconds?: number;
    actualDurationMinutes?: number;
  },
): Promise<Task> {
  const data = await apiRequest<{task: Task}>(`/tasks/${taskId}`, 'PATCH', updates);
  return data.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiRequest<void>(`/tasks/${taskId}`, 'DELETE');
}

export async function createCategory(
  input: CreateCategoryInput & {id?: string},
): Promise<Category> {
  const data = await apiRequest<{category: Category}>('/categories', 'POST', {
    ...input,
    color: normalizeCategoryColor(input.color),
    icon: input.icon || DEFAULT_CATEGORY_ICON,
  });
  return data.category;
}

export async function updateCategory(
  categoryId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const data = await apiRequest<{category: Category}>(
    `/categories/${categoryId}`,
    'PATCH',
    {
      ...input,
      color: normalizeCategoryColor(input.color),
      icon: input.icon || DEFAULT_CATEGORY_ICON,
    },
  );
  return data.category;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiRequest<void>(`/categories/${categoryId}`, 'DELETE');
}

export async function createHabit(
  input: CreateHabitInput & {id?: string},
): Promise<Habit> {
  const data = await apiRequest<{habit: Habit}>('/habits', 'POST', input);
  return data.habit;
}

export async function updateHabit(
  habitId: string,
  updates: Partial<CreateHabitInput>,
): Promise<Habit> {
  const data = await apiRequest<{habit: Habit}>(`/habits/${habitId}`, 'PATCH', updates);
  return data.habit;
}

export async function deleteHabit(habitId: string): Promise<void> {
  await apiRequest<void>(`/habits/${habitId}`, 'DELETE');
}

export async function createNote(
  input: CreateNoteInput & {id?: string},
): Promise<Note> {
  const data = await apiRequest<{note: Note}>('/notes', 'POST', input);
  return data.note;
}

export async function updateNote(
  noteId: string,
  updates: UpdateNoteInput,
): Promise<Note> {
  const data = await apiRequest<{note: Note}>(`/notes/${noteId}`, 'PATCH', updates);
  return data.note;
}

export async function deleteNote(noteId: string): Promise<void> {
  await apiRequest<void>(`/notes/${noteId}`, 'DELETE');
}

export async function completeHabit(
  habitId: string,
  date?: string,
): Promise<HabitCompletionMutationResponse> {
  return apiRequest(`/habits/${habitId}/complete`, 'POST', date ? {date} : {});
}

export async function uncompleteHabit(
  habitId: string,
  date?: string,
): Promise<HabitCompletionMutationResponse> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest(`/habits/${habitId}/complete${qs}`, 'DELETE');
}

export async function startHabitTimer(
  habitId: string,
  date?: string,
): Promise<Habit> {
  const data = await apiRequest<{habit: Habit}>(
    `/habits/${habitId}/start`,
    'POST',
    date ? {date} : {},
  );
  return data.habit;
}

export async function pauseHabitTimer(
  habitId: string,
  date?: string,
): Promise<Habit> {
  const data = await apiRequest<{habit: Habit}>(
    `/habits/${habitId}/pause`,
    'POST',
    date ? {date} : {},
  );
  return data.habit;
}

export async function fetchSyncPull(
  since?: string | null,
): Promise<SyncPullResponse> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiRequest<SyncPullResponse>(`/sync/pull${qs}`, 'GET');
}
