import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchHabits,
  createHabit as apiCreateHabit,
  deleteHabit as apiDeleteHabit,
} from "../services/api";
import { useAuth } from "./AuthContext";
import type { CreateHabitInput, Habit } from "../types/habit";

function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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
    } catch (err) {
      console.error('[HabitsContext] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Optimistic add
  const addHabit = useCallback(async (input: CreateHabitInput) => {
    const id = tempId();
    const optimistic: Habit = {
      id,
      title: input.title,
      frequency: input.frequency,
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
