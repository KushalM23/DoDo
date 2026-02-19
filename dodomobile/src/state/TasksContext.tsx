import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTask, deleteTask, fetchTasks, updateTask } from "../services/api";
import { useAuth } from "./AuthContext";
import type { CreateTaskInput, Task } from "../types/task";
import { sortTasks, type SortMode } from "../utils/taskSort";

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
        const nextTasks = await fetchTasks(date);
        setTasks(sortTasks(nextTasks, sortMode));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    },
    [user, sortMode],
  );

  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      const task = await createTask(input);
      setTasks((prev) => sortTasks([task, ...prev], sortMode));
    },
    [sortMode],
  );

  const toggleTaskCompletion = useCallback(
    async (task: Task) => {
      const updated = await updateTask(task.id, { completed: !task.completed });
      setTasks((prev) => sortTasks(prev.map((item) => (item.id === updated.id ? updated : item)), sortMode));
    },
    [sortMode],
  );

  const startTimer = useCallback(
    async (task: Task) => {
      const updated = await updateTask(task.id, { timerStartedAt: new Date().toISOString() });
      setTasks((prev) => sortTasks(prev.map((item) => (item.id === updated.id ? updated : item)), sortMode));
    },
    [sortMode],
  );

  const removeTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
    setTasks((prev) => prev.filter((item) => item.id !== taskId));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-sort when sort mode changes
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

