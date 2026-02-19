import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchHabits,
  createHabit as apiCreateHabit,
  deleteHabit as apiDeleteHabit,
} from "../services/api";
import { useAuth } from "./AuthContext";
import type { CreateHabitInput, Habit } from "../types/habit";

type HabitsContextValue = {
  habits: Habit[];
  loading: boolean;
  refresh: () => Promise<void>;
  addHabit: (input: CreateHabitInput) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
};

const HabitsContext = createContext<HabitsContextValue | undefined>(undefined);

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setHabits([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchHabits();
      setHabits(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addHabit = useCallback(async (input: CreateHabitInput) => {
    const habit = await apiCreateHabit(input);
    setHabits((prev) => [...prev, habit]);
  }, []);

  const removeHabit = useCallback(async (id: string) => {
    await apiDeleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<HabitsContextValue>(
    () => ({ habits, loading, refresh, addHabit, removeHabit }),
    [habits, loading, refresh, addHabit, removeHabit],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used inside HabitsProvider");
  return ctx;
}
