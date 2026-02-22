import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchHabits,
  createHabit as apiCreateHabit,
  deleteHabit as apiDeleteHabit,
  updateHabit as apiUpdateHabit,
  fetchHabitHistory,
  completeHabit as apiCompleteHabit,
  uncompleteHabit as apiUncompleteHabit,
  startHabitTimer as apiStartHabitTimer,
  pauseHabitTimer as apiPauseHabitTimer,
} from "../services/api";
import { useAuth } from "./AuthContext";
import { DEFAULT_HABIT_ICON, type CreateHabitInput, type Habit } from "../types/habit";

function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function localDateKey(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
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
  loadHistory: (params: { startDate?: string; endDate?: string; days?: number; habitId?: string }) => Promise<void>;
  isHabitCompletedOn: (habitId: string, date: string) => boolean;
  setHabitCompletedOn: (habitId: string, date: string, completed: boolean) => Promise<void>;
  startHabitTimer: (habitId: string, date?: string) => Promise<void>;
  pauseHabitTimer: (habitId: string, date?: string) => Promise<void>;
};

const HabitsContext = createContext<HabitsContextValue | undefined>(undefined);

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setHabits([]);
      setCompletionMap({});
      setInitialized(true);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchHabits();
      setHabits(data);
    } catch (err) {
      console.error('[HabitsContext] refresh error:', err);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user]);

  useEffect(() => {
    setInitialized(false);
  }, [user?.id]);

  // Optimistic add
  const addHabit = useCallback(async (input: CreateHabitInput) => {
    const id = tempId();
    const optimistic: Habit = {
      id,
      title: input.title,
      icon: input.icon ?? DEFAULT_HABIT_ICON,
      frequencyType: input.frequencyType,
      intervalDays: input.intervalDays ?? null,
      customDays: input.customDays ?? [],
      timeMinute: input.timeMinute ?? null,
      durationMinutes: input.durationMinutes ?? null,
      anchorDate: input.anchorDate ?? localDateKey(new Date()),
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedOn: null,
      nextOccurrenceOn: null,
      timerStartedAt: null,
      trackedSecondsToday: 0,
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, optimistic]);

    apiCreateHabit(input)
      .then((real) => {
        setHabits((prev) => prev.map((h) => (h.id === id ? real : h)));
      })
      .catch((err) => {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        console.error('[HabitsContext] addHabit sync error:', err);
      });
  }, []);

  const editHabit = useCallback(async (habitId: string, input: Partial<CreateHabitInput>) => {
    const before = habits.find((h) => h.id === habitId);
    if (!before) return;

    setHabits((prev) => prev.map((h) => (h.id === habitId ? {
      ...h,
      title: input.title ?? h.title,
      frequencyType: input.frequencyType ?? h.frequencyType,
      intervalDays: input.intervalDays ?? h.intervalDays,
      customDays: input.customDays ?? h.customDays,
      timeMinute: input.timeMinute ?? h.timeMinute,
      durationMinutes: input.durationMinutes ?? h.durationMinutes,
    } : h)));

    try {
      const updated = await apiUpdateHabit(habitId, input);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
    } catch (err) {
      setHabits((prev) => prev.map((h) => (h.id === habitId ? before : h)));
      throw err;
    }
  }, [habits]);

  // Optimistic remove
  const removeHabit = useCallback(async (id: string) => {
    let removed: Habit | undefined;
    setHabits((prev) => {
      removed = prev.find((h) => h.id === id);
      return prev.filter((h) => h.id !== id);
    });

    apiDeleteHabit(id).catch((err) => {
      if (removed) {
        setHabits((prev) => [...prev, removed!]);
      }
      console.error('[HabitsContext] removeHabit sync error:', err);
    });
    setCompletionMap((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const loadHistory = useCallback(async (params: { startDate?: string; endDate?: string; days?: number; habitId?: string }) => {
    const rows = await fetchHabitHistory(params);
    setCompletionMap((prev) => {
      const next = { ...prev };

      if (params.startDate && params.endDate) {
        const from = params.startDate;
        const to = params.endDate;
        const clearDatesInRange = (dateMap: Record<string, boolean>) => {
          const out: Record<string, boolean> = {};
          Object.entries(dateMap).forEach(([date, value]) => {
            if (date < from || date > to) {
              out[date] = value;
            }
          });
          return out;
        };

        if (params.habitId) {
          if (next[params.habitId]) {
            next[params.habitId] = clearDatesInRange(next[params.habitId]);
          }
        } else {
          Object.keys(next).forEach((habitId) => {
            next[habitId] = clearDatesInRange(next[habitId]);
          });
        }
      }

      for (const row of rows) {
        if (!next[row.habitId]) next[row.habitId] = {};
        next[row.habitId] = { ...next[row.habitId], [row.date]: true };
      }
      return next;
    });
  }, []);

  const isHabitCompletedOn = useCallback((habitId: string, date: string) => {
    return !!completionMap[habitId]?.[date];
  }, [completionMap]);

  const setHabitCompletedOn = useCallback(async (habitId: string, date: string, completed: boolean) => {
    setCompletionMap((prev) => ({
      ...prev,
      [habitId]: {
        ...(prev[habitId] ?? {}),
        [date]: completed,
      },
    }));

    try {
      const updated = completed
        ? await apiCompleteHabit(habitId, date)
        : await apiUncompleteHabit(habitId, date);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
    } catch (err) {
      setCompletionMap((prev) => ({
        ...prev,
        [habitId]: {
          ...(prev[habitId] ?? {}),
          [date]: !completed,
        },
      }));
      throw err;
    }
  }, []);

  const startHabitTimer = useCallback(async (habitId: string, date?: string) => {
    const targetDate = date;
    const nowIso = new Date().toISOString();
    setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, timerStartedAt: nowIso } : h)));

    try {
      const updated = await apiStartHabitTimer(habitId, targetDate);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
    } catch (err) {
      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, timerStartedAt: null } : h)));
      throw err;
    }
  }, []);

  const pauseHabitTimer = useCallback(async (habitId: string, date?: string) => {
    const previous = habits.find((h) => h.id === habitId)?.timerStartedAt ?? null;
    setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, timerStartedAt: null } : h)));

    try {
      const updated = await apiPauseHabitTimer(habitId, date);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
    } catch (err) {
      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, timerStartedAt: previous } : h)));
      throw err;
    }
  }, [habits]);

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
      initialized,
      loading,
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
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used inside HabitsProvider");
  return ctx;
}
