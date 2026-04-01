import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createHabitLocal,
  listHabitCompletionMapLocal,
  listHabitsLocal,
  setHabitCompletedLocal,
  setHabitTimerLocal,
  softDeleteHabitLocal,
  updateHabitLocal,
} from '@/lib/local/repository';
import {runSync} from '@/lib/local/syncEngine';
import {useAuth} from './AuthContext';
import {
  DEFAULT_HABIT_ICON,
  type CreateHabitInput,
  type Habit,
} from '@/types/habit';

function localDateKey(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type HabitsContextValue = {
  habits: Habit[];
  loading: boolean;
  initialized: boolean;
  completionMap: Record<string, Record<string, boolean>>;
  refresh: () => Promise<void>;
  addHabit: (input: CreateHabitInput) => Promise<void>;
  editHabit: (habitId: string, input: Partial<CreateHabitInput>) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  loadHistory: (params: {
    startDate?: string;
    endDate?: string;
    days?: number;
    habitId?: string;
  }) => Promise<void>;
  isHabitCompletedOn: (habitId: string, date: string) => boolean;
  setHabitCompletedOn: (
    habitId: string,
    date: string,
    completed: boolean,
  ) => Promise<void>;
  startHabitTimer: (habitId: string, date?: string) => Promise<void>;
  pauseHabitTimer: (habitId: string, date?: string) => Promise<void>;
};

const HabitsContext = createContext<HabitsContextValue | undefined>(undefined);

export function HabitsProvider({children}: {children: React.ReactNode}) {
  const {user, refreshUser} = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const reconcileLocalState = useCallback(async (userId: string) => {
    const [nextHabits, nextCompletionMap] = await Promise.all([
      listHabitsLocal(userId),
      listHabitCompletionMapLocal(userId),
    ]);
    setHabits(nextHabits);
    setCompletionMap(nextCompletionMap);
  }, []);

  const syncAndReconcile = useCallback(
    async (userId: string, refreshProgress = false) => {
      const didSync = await runSync(userId, 'manual');
      if (!didSync) {
        return false;
      }
      await reconcileLocalState(userId);
      if (refreshProgress) {
        await refreshUser();
      }
      return true;
    },
    [reconcileLocalState, refreshUser],
  );

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setHabits([]);
      setCompletionMap({});
      setInitialized(true);
      return;
    }
    setLoading(true);
    try {
      await reconcileLocalState(user.id);
      void syncAndReconcile(user.id);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [reconcileLocalState, syncAndReconcile, user?.id]);

  useEffect(() => {
    setInitialized(false);
  }, [user?.id]);

  const addHabit = useCallback(
    async (input: CreateHabitInput) => {
      if (!user?.id) {
        return;
      }
      const optimistic = await createHabitLocal(user.id, {
        ...input,
        icon: input.icon ?? DEFAULT_HABIT_ICON,
        anchorDate: input.anchorDate ?? localDateKey(new Date()),
      });
      setHabits(prev => [...prev, optimistic]);
      void syncAndReconcile(user.id);
    },
    [syncAndReconcile, user?.id],
  );

  const editHabit = useCallback(
    async (habitId: string, input: Partial<CreateHabitInput>) => {
      if (!user?.id) {
        return;
      }
      const before = habits.find(habit => habit.id === habitId);
      if (!before) {
        return;
      }

      setHabits(prev =>
        prev.map(habit =>
          habit.id === habitId
            ? {
                ...habit,
                title: input.title ?? habit.title,
                icon: input.icon ?? habit.icon,
                frequencyType: input.frequencyType ?? habit.frequencyType,
                intervalDays: input.intervalDays ?? habit.intervalDays,
                customDays: input.customDays ?? habit.customDays,
                timeMinute: input.timeMinute ?? habit.timeMinute,
                durationMinutes: input.durationMinutes ?? habit.durationMinutes,
              }
            : habit,
        ),
      );

      const updated = await updateHabitLocal(user.id, habitId, input);
      if (!updated) {
        setHabits(prev => prev.map(habit => (habit.id === habitId ? before : habit)));
        return;
      }
      setHabits(prev => prev.map(habit => (habit.id === habitId ? updated : habit)));
      void syncAndReconcile(user.id);
    },
    [habits, syncAndReconcile, user?.id],
  );

  const removeHabit = useCallback(
    async (id: string) => {
      if (!user?.id) {
        return;
      }
      await softDeleteHabitLocal(user.id, id);
      setHabits(prev => prev.filter(habit => habit.id !== id));
      setCompletionMap(prev => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      void syncAndReconcile(user.id);
    },
    [syncAndReconcile, user?.id],
  );

  const loadHistory = useCallback(
    async (params: {
      startDate?: string;
      endDate?: string;
      days?: number;
      habitId?: string;
    }) => {
      if (!user?.id) {
        return;
      }
      const rows = await listHabitCompletionMapLocal(user.id, {
        startDate: params.startDate,
        endDate: params.endDate,
        habitId: params.habitId,
      });
      setCompletionMap(prev => ({...prev, ...rows}));
    },
    [user?.id],
  );

  const isHabitCompletedOn = useCallback(
    (habitId: string, date: string) => Boolean(completionMap[habitId]?.[date]),
    [completionMap],
  );

  const setHabitCompletedOn = useCallback(
    async (habitId: string, date: string, completed: boolean) => {
      if (!user?.id) {
        return;
      }
      setCompletionMap(prev => ({
        ...prev,
        [habitId]: {
          ...(prev[habitId] ?? {}),
          [date]: completed,
        },
      }));

      await setHabitCompletedLocal({userId: user.id, habitId, date, completed});
      await syncAndReconcile(user.id, true);
    },
    [syncAndReconcile, user?.id],
  );

  const startHabitTimer = useCallback(
    async (habitId: string, date?: string) => {
      if (!user?.id) {
        return;
      }
      const nowIso = new Date().toISOString();
      setHabits(prev =>
        prev.map(habit => (habit.id === habitId ? {...habit, timerStartedAt: nowIso} : habit)),
      );
      await setHabitTimerLocal({
        userId: user.id,
        habitId,
        date,
        startedAt: nowIso,
        action: 'start_timer',
      });
      void syncAndReconcile(user.id);
    },
    [syncAndReconcile, user?.id],
  );

  const pauseHabitTimer = useCallback(
    async (habitId: string, date?: string) => {
      if (!user?.id) {
        return;
      }
      setHabits(prev =>
        prev.map(habit => (habit.id === habitId ? {...habit, timerStartedAt: null} : habit)),
      );
      await setHabitTimerLocal({
        userId: user.id,
        habitId,
        date,
        startedAt: null,
        action: 'pause_timer',
      });
      void syncAndReconcile(user.id);
    },
    [syncAndReconcile, user?.id],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<HabitsContextValue>(
    () => ({
      habits,
      loading,
      initialized,
      completionMap,
      refresh,
      addHabit,
      editHabit,
      removeHabit,
      loadHistory,
      isHabitCompletedOn,
      setHabitCompletedOn,
      startHabitTimer,
      pauseHabitTimer,
    }),
    [
      habits,
      loading,
      initialized,
      completionMap,
      refresh,
      addHabit,
      editHabit,
      removeHabit,
      loadHistory,
      isHabitCompletedOn,
      setHabitCompletedOn,
      startHabitTimer,
      pauseHabitTimer,
    ],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits must be used inside HabitsProvider');
  }
  return context;
}

