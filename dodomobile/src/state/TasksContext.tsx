import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTask, deleteTask, fetchTasks, updateTask } from "../services/api";
import { useAuth } from "./AuthContext";
import type { CreateTaskInput, Task } from "../types/task";
import { sortTasks, type SortMode } from "../utils/taskSort";

function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

type TasksContextValue = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  refresh: (date?: string) => Promise<void>;
  addTask: (input: CreateTaskInput) => Promise<void>;
  toggleTaskCompletion: (task: Task) => Promise<void>;
  startTimer: (task: Task) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  const refresh = useCallback(
    async (date?: string) => {
      if (!user) {
        setTasks([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const nextTasks = await fetchTasks();
        setTasks(sortTasks(nextTasks, sortMode));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    },
    [user, sortMode],
  );

  // Optimistic add: insert locally with temp ID, sync in background
  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      const id = tempId();
      const optimistic: Task = {
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
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => sortTasks([optimistic, ...prev], sortMode));

      // Background sync
      createTask(input)
        .then((real) => {
          setTasks((prev) => sortTasks(prev.map((t) => (t.id === id ? real : t)), sortMode));
        })
        .catch((err) => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
          console.error("[TasksContext] addTask sync error:", err);
        });
    },
    [sortMode],
  );

  // Optimistic toggle: flip locally, sync in background
  const toggleTaskCompletion = useCallback(
    async (task: Task) => {
      const updated: Task = {
        ...task,
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null,
      };
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? updated : t)), sortMode));

      updateTask(task.id, { completed: !task.completed }).catch((err) => {
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? task : t)), sortMode));
        console.error("[TasksContext] toggleTaskCompletion sync error:", err);
      });
    },
    [sortMode],
  );

  // Optimistic start: set timer locally, sync in background
  const startTimer = useCallback(
    async (task: Task) => {
      const now = new Date().toISOString();
      const updated: Task = { ...task, timerStartedAt: now };
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? updated : t)), sortMode));

      updateTask(task.id, { timerStartedAt: now }).catch((err) => {
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? task : t)), sortMode));
        console.error("[TasksContext] startTimer sync error:", err);
      });
    },
    [sortMode],
  );

  // Optimistic remove: delete locally, sync in background
  const removeTask = useCallback(
    async (taskId: string) => {
      let removed: Task | undefined;
      setTasks((prev) => {
        removed = prev.find((t) => t.id === taskId);
        return prev.filter((t) => t.id !== taskId);
      });

      deleteTask(taskId).catch((err) => {
        if (removed) {
          setTasks((prev) => sortTasks([...prev, removed!], sortMode));
        }
        console.error("[TasksContext] removeTask sync error:", err);
      });
    },
    [sortMode],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setTasks((prev) => sortTasks([...prev], sortMode));
  }, [sortMode]);

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      loading,
      error,
      sortMode,
      setSortMode,
      refresh,
      addTask,
      toggleTaskCompletion,
      startTimer,
      removeTask,
    }),
    [addTask, error, loading, refresh, removeTask, sortMode, startTimer, tasks, toggleTaskCompletion],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used inside TasksProvider");
  }
  return context;
}
