import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTask, deleteTask, fetchTasks, updateTask } from "../services/api";
import { useAuth } from "./AuthContext";
import type { CreateTaskInput, Task } from "../types/task";
import { sortTasks, type SortMode } from "../utils/taskSort";

type TasksContextValue = {
  tasks: Task[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  refresh: (date?: string) => Promise<void>;
  addTask: (input: CreateTaskInput) => Promise<void>;
  toggleTaskCompletion: (task: Task) => Promise<void>;
  startTimer: (task: Task) => Promise<void>;
  pauseTimer: (task: Task) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  updateTaskDetails: (
    taskId: string,
    updates: Partial<CreateTaskInput> & { completed?: boolean; timerStartedAt?: string | null },
  ) => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  const refresh = useCallback(
    async (_date?: string) => {
      if (!user) {
        setTasks([]);
        setInitialized(true);
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
        setInitialized(true);
      }
    },
    [user, sortMode],
  );

  useEffect(() => {
    setInitialized(false);
  }, [user?.id]);

  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const optimisticTask: Task = {
        id: tempId,
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

      setTasks((prev) => sortTasks([optimisticTask, ...prev], sortMode));

      try {
        const created = await createTask(input);
        setTasks((prev) =>
          sortTasks(prev.map((t) => (t.id === tempId ? created : t)), sortMode),
        );
      } catch (err) {
        setTasks((prev) => sortTasks(prev.filter((t) => t.id !== tempId), sortMode));
        throw err;
      }
    },
    [sortMode],
  );

  const toggleTaskCompletion = useCallback(
    async (task: Task) => {
      const newCompleted = !task.completed;
      const optimistic: Task = {
        ...task,
        completed: newCompleted,
        completedAt: newCompleted ? new Date().toISOString() : null,
      };
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? optimistic : t)), sortMode));

      try {
        const updated = await updateTask(task.id, { completed: newCompleted });
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? updated : t)), sortMode));
      } catch {
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? task : t)), sortMode));
      }
    },
    [sortMode],
  );

  const startTimer = useCallback(
    async (task: Task) => {
      const now = new Date().toISOString();
      const optimistic: Task = { ...task, timerStartedAt: now };
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? optimistic : t)), sortMode));

      try {
        const updated = await updateTask(task.id, { timerStartedAt: now });
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? updated : t)), sortMode));
      } catch {
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? task : t)), sortMode));
      }
    },
    [sortMode],
  );

  const pauseTimer = useCallback(
    async (task: Task) => {
      const optimistic: Task = { ...task, timerStartedAt: null };
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? optimistic : t)), sortMode));

      try {
        const updated = await updateTask(task.id, { timerStartedAt: null });
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? updated : t)), sortMode));
      } catch {
        setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? task : t)), sortMode));
      }
    },
    [sortMode],
  );

  const updateTaskDetails = useCallback(
    async (
      taskId: string,
      updates: Partial<CreateTaskInput> & { completed?: boolean; timerStartedAt?: string | null },
    ) => {
      const updated = await updateTask(taskId, updates);
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === taskId ? updated : t)), sortMode));
    },
    [sortMode],
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      let removedTask: Task | null = null;
      setTasks((prev) => {
        removedTask = prev.find((t) => t.id === taskId) ?? null;
        return sortTasks(prev.filter((t) => t.id !== taskId), sortMode);
      });

      try {
        await deleteTask(taskId);
      } catch (err) {
        if (removedTask) {
          setTasks((prev) => sortTasks([removedTask as Task, ...prev], sortMode));
        }
        throw err;
      }
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
      initialized,
      error,
      sortMode,
      setSortMode,
      refresh,
      addTask,
      toggleTaskCompletion,
      startTimer,
      pauseTimer,
      removeTask,
      updateTaskDetails,
    }),
    [addTask, error, initialized, loading, pauseTimer, refresh, removeTask, sortMode, startTimer, tasks, toggleTaskCompletion, updateTaskDetails],
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
