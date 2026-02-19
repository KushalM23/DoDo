import { env } from "../config/env";
import type { AuthUser } from "../types/auth";
import type { CreateTaskInput, Task } from "../types/task";
import type { Category, CreateCategoryInput } from "../types/category";
import type { CreateHabitInput, Habit, HabitCompletionRecord } from "../types/habit";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function apiRequest<T>(path: string, method: ApiMethod, body?: object, requiresAuth = true): Promise<T> {
  if (requiresAuth && !authToken) {
    throw new Error("You are not logged in.");
  }

  const url = `${env.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data = {} as T & { error?: string };
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error("Server returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
}

export async function register(email: string, password: string, displayName: string): Promise<{
  user: AuthUser;
  token: string | null;
  requiresEmailConfirmation: boolean;
}> {
  return apiRequest(
    "/auth/register",
    "POST",
    { email: email.trim(), password, displayName: displayName.trim() },
    false,
  );
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  return apiRequest(
    "/auth/login",
    "POST",
    { email: email.trim(), password },
    false,
  );
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await apiRequest<{ user: AuthUser }>("/auth/me", "GET");
  return data.user;
}

export async function changePassword(newPassword: string): Promise<void> {
  await apiRequest<void>("/auth/change-password", "POST", { newPassword });
}

export async function deleteAccount(): Promise<void> {
  await apiRequest<void>("/auth/delete-account", "DELETE");
}

export async function fetchTasks(categoryId?: string): Promise<Task[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${qs}`, "GET");
  return data.tasks;
}

export async function fetchTasksByDate(date: string): Promise<Task[]> {
  const qs = `?date=${encodeURIComponent(date)}`;
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${qs}`, "GET");
  return data.tasks;
}

export async function fetchTasksInRange(startAt: string, endAt: string): Promise<Task[]> {
  const qs = `?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`;
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${qs}`, "GET");
  return data.tasks;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const data = await apiRequest<{ task: Task }>("/tasks", "POST", input);
  return data.task;
}

export async function updateTask(
  taskId: string,
  updates: Partial<CreateTaskInput> & { completed?: boolean; timerStartedAt?: string | null },
): Promise<Task> {
  const data = await apiRequest<{ task: Task }>(`/tasks/${taskId}`, "PATCH", updates);
  return data.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiRequest<void>(`/tasks/${taskId}`, "DELETE");
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await apiRequest<{ categories: Category[] }>("/categories", "GET");
  return data.categories;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const data = await apiRequest<{ category: Category }>("/categories", "POST", input);
  return data.category;
}

export async function updateCategory(categoryId: string, input: CreateCategoryInput): Promise<Category> {
  const data = await apiRequest<{ category: Category }>(`/categories/${categoryId}`, "PATCH", input);
  return data.category;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiRequest<void>(`/categories/${categoryId}`, "DELETE");
}

export async function fetchHabits(): Promise<Habit[]> {
  const data = await apiRequest<{ habits: Habit[] }>("/habits", "GET");
  return data.habits;
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const data = await apiRequest<{ habit: Habit }>("/habits", "POST", input);
  return data.habit;
}

export async function updateHabit(
  habitId: string,
  updates: Partial<CreateHabitInput>,
): Promise<Habit> {
  const data = await apiRequest<{ habit: Habit }>(`/habits/${habitId}`, "PATCH", updates);
  return data.habit;
}

export async function deleteHabit(habitId: string): Promise<void> {
  await apiRequest<void>(`/habits/${habitId}`, "DELETE");
}

export async function fetchHabitHistory(params?: {
  habitId?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
}): Promise<HabitCompletionRecord[]> {
  const search = new URLSearchParams();
  if (params?.habitId) search.set("habitId", params.habitId);
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  if (params?.days != null) search.set("days", String(params.days));
  const qs = search.toString();
  const data = await apiRequest<{ history: HabitCompletionRecord[] }>(`/habits/history${qs ? `?${qs}` : ""}`, "GET");
  return data.history;
}

export async function completeHabit(habitId: string, date?: string): Promise<Habit> {
  const data = await apiRequest<{ habit: Habit }>(`/habits/${habitId}/complete`, "POST", date ? { date } : {});
  return data.habit;
}

export async function uncompleteHabit(habitId: string, date?: string): Promise<Habit> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const data = await apiRequest<{ habit: Habit }>(`/habits/${habitId}/complete${qs}`, "DELETE");
  return data.habit;
}
