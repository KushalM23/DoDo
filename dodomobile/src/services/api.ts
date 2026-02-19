import { env } from "../config/env";
import { supabase } from "../lib/supabase";
import type { CreateTaskInput, Task } from "../types/task";
import type { Category, CreateCategoryInput } from "../types/category";
import type { CreateHabitInput, Habit } from "../types/habit";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("No active session. Please log in again.");
  }
  return data.session.access_token;
}

async function apiRequest<T>(path: string, method: ApiMethod, body?: object): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

// ── Tasks ──────────────────────────────────────────────

export async function fetchTasks(date?: string, categoryId?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (categoryId) params.set("categoryId", categoryId);
  const qs = params.toString();
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${qs ? `?${qs}` : ""}`, "GET");
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

// ── Categories ─────────────────────────────────────────

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

// ── Habits ─────────────────────────────────────────────

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

