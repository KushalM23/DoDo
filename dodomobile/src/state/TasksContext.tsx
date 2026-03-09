import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createTaskLocal,
  listTasksLocal,
  softDeleteTaskLocal,
  updateTaskLocal,
} from '../lib/local/repository';
import {runSync} from '../lib/local/syncEngine';
import {useAuth} from './AuthContext';
import type {CreateTaskInput, Task} from '../types/task';
import {sortTasks, type SortMode} from '../utils/taskSort';

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
    updates: Partial<CreateTaskInput> & {
      completed?: boolean;
      timerStartedAt?: string | null;
      actualDurationSeconds?: number;
      actualDurationMinutes?: number;
    },
  ) => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({children}: {children: React.ReactNode}) {
  const {user, refreshUser} = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('smart');

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
        const nextTasks = await listTasksLocal(user.id);
        setTasks(sortTasks(nextTasks, sortMode));

        // Sync in background, then reconcile local state silently.
        void runSync(user.id, 'manual').then(async didPushAndPull => {
          if (!didPushAndPull) {
            return;
          }
          const reconciled = await listTasksLocal(user.id);
          setTasks(sortTasks(reconciled, sortMode));
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks.');
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
      if (!user?.id) {
        return;
      }
      const created = await createTaskLocal(user.id, input);
      setTasks(prev => sortTasks([created, ...prev], sortMode));
      void runSync(user.id, 'manual');
    },
    [sortMode, user?.id],
  );

  const toggleTaskCompletion = useCallback(
    async (task: Task) => {
      if (!user?.id) {
        return;
      }
      const newCompleted = !task.completed;
      const optimistic: Task = {
        ...task,
        completed: newCompleted,
        completedAt: newCompleted ? new Date().toISOString() : null,
      };
      setTasks(prev =>
        sortTasks(
          prev.map(t => (t.id === task.id ? optimistic : t)),
          sortMode,
        ),
      );

      const updated = await updateTaskLocal(user.id, task.id, {
        completed: newCompleted,
      });
      if (updated) {
        setTasks(prev =>
          sortTasks(
            prev.map(t => (t.id === task.id ? updated : t)),
            sortMode,
          ),
        );
      }

      const didSync = await runSync(user.id, 'manual');
      if (!didSync) {
        return;
      }

      const reconciled = await listTasksLocal(user.id);
      setTasks(sortTasks(reconciled, sortMode));
      await refreshUser();
    },
    [refreshUser, sortMode, user?.id],
  );

  const startTimer = useCallback(
    async (task: Task) => {
      if (!user?.id || task.completed || task.timerStartedAt) {
        return;
      }
      const now = new Date().toISOString();
      const optimistic: Task = {...task, timerStartedAt: now};
      setTasks(prev =>
        sortTasks(
          prev.map(t => (t.id === task.id ? optimistic : t)),
          sortMode,
        ),
      );

      const updated = await updateTaskLocal(user.id, task.id, {
        timerStartedAt: now,
      });
      if (updated) {
        setTasks(prev =>
          sortTasks(
            prev.map(t => (t.id === task.id ? updated : t)),
            sortMode,
          ),
        );
      }
      void runSync(user.id, 'manual');
    },
    [sortMode, user?.id],
  );

  const pauseTimer = useCallback(
    async (task: Task) => {
      if (!user?.id || !task.timerStartedAt) {
        return;
      }
      const updated = await updateTaskLocal(user.id, task.id, {
        timerStartedAt: null,
      });
      if (!updated) {
        return;
      }
      setTasks(prev =>
        sortTasks(
          prev.map(t => (t.id === task.id ? updated : t)),
          sortMode,
        ),
      );

      void runSync(user.id, 'manual');
    },
    [sortMode, user?.id],
  );

  const updateTaskDetails = useCallback(
    async (
      taskId: string,
      updates: Partial<CreateTaskInput> & {
        completed?: boolean;
        timerStartedAt?: string | null;
        actualDurationSeconds?: number;
        actualDurationMinutes?: number;
      },
    ) => {
      if (!user?.id) {
        return;
      }
      const updated = await updateTaskLocal(user.id, taskId, updates);
      if (!updated) {
        return;
      }
      setTasks(prev =>
        sortTasks(
          prev.map(t => (t.id === taskId ? updated : t)),
          sortMode,
        ),
      );

      const shouldRefreshProgress = updates.completed !== undefined;
      const didSync = await runSync(user.id, 'manual');
      if (!didSync) {
        return;
      }

      const reconciled = await listTasksLocal(user.id);
      setTasks(sortTasks(reconciled, sortMode));
      if (shouldRefreshProgress) {
        await refreshUser();
      }
    },
    [refreshUser, sortMode, user?.id],
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!user?.id) {
        return;
      }
      await softDeleteTaskLocal(user.id, taskId);
      setTasks(prev => sortTasks(prev.filter(t => t.id !== taskId), sortMode));
      void runSync(user.id, 'manual');
    },
    [sortMode, user?.id],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setTasks(prev => sortTasks([...prev], sortMode));
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
    [
      addTask,
      error,
      initialized,
      loading,
      pauseTimer,
      refresh,
      removeTask,
      sortMode,
      startTimer,
      tasks,
      toggleTaskCompletion,
      updateTaskDetails,
    ],
  );

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
}

export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used inside TasksProvider');
  }
  return context;
}
