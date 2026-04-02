import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { cx } from "@/lib/tw";
import { useAuth } from "@/providers/AuthContext";
import { useCategories } from "@/providers/CategoriesContext";
import { useHabits } from "@/providers/HabitsContext";
import { useTasks } from "@/providers/TasksContext";
import { SettingsPanel } from "@/screens/SettingsScreen";
import { habitAppliesToDate } from "@/utils/habits";
import {
  getTaskPlannedSeconds,
  getTaskTrackedSeconds,
} from "@/utils/taskTiming";
import { toLocalDateKey } from "@/utils/dateTime";

function calculateStreaks(completedDateKeys: string[]) {
  if (completedDateKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const uniqueSorted = [...new Set(completedDateKeys)].sort();
  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00`);
    const current = new Date(`${uniqueSorted[i]}T00:00:00`);
    const daysDiff = Math.round(
      (current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysDiff === 1) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 1;
    }
  }

  const completedSet = new Set(uniqueSorted);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  let probeDate = completedSet.has(todayKey)
    ? today
    : completedSet.has(yesterdayKey)
    ? yesterday
    : null;
  let currentStreak = 0;

  while (probeDate) {
    const key = toLocalDateKey(probeDate);
    if (!completedSet.has(key)) {
      break;
    }
    currentStreak += 1;
    const next = new Date(probeDate);
    next.setDate(next.getDate() - 1);
    probeDate = next;
  }

  return { currentStreak, bestStreak };
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: AppIconName;
}) {
  return (
    <div className="flex items-center gap-5 py-5">
      <div className="grid h-10 w-10 place-items-center rounded-full">
        <AppIcon name={icon} size={18} color="var(--accent)" />
      </div>
      <div className="flex-1">
        <span className="font-sans-semibold text-[16px] text-text">
          {label}
        </span>
      </div>
      <strong className="font-display-semibold text-[24px] tracking-[-0.5px] text-text">
        {value}
      </strong>
    </div>
  );
}

export function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { tasks, initialized: tasksInitialized } = useTasks();
  const {
    habits,
    initialized: habitsInitialized,
    loadHistory,
    completionMap,
  } = useHabits();
  const { categories, initialized: categoriesInitialized } = useCategories();
  const settingsSectionRef = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    void refreshUser();
    void loadHistory({});
  }, [loadHistory, refreshUser]);

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.completed),
    [tasks],
  );
  const completedHabitDateKeys = useMemo(
    () =>
      Object.values(completionMap).flatMap((days) =>
        Object.entries(days)
          .filter(([, completed]) => completed)
          .map(([date]) => date),
      ),
    [completionMap],
  );
  const completedDateKeys = useMemo(
    () =>
      completedTasks
        .map((task) => toLocalDateKey(task.completedAt ?? task.scheduledAt))
        .concat(completedHabitDateKeys),
    [completedHabitDateKeys, completedTasks],
  );

  const { currentStreak, bestStreak } = useMemo(
    () => calculateStreaks(completedDateKeys),
    [completedDateKeys],
  );

  const totalTasks = tasks.length;
  const totalCompleted = completedTasks.length;
  const completionPct =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const activeTasks = tasks.filter((task) => !task.completed).length;
  const overdueTasks = tasks.filter(
    (task) => !task.completed && new Date(task.deadline).getTime() < Date.now(),
  ).length;

  const taskTimeStats = useMemo(() => {
    const actualSeconds = completedTasks.reduce(
      (sum, task) => sum + getTaskTrackedSeconds(task),
      0,
    );
    const allottedSeconds = completedTasks.reduce(
      (sum, task) => sum + getTaskPlannedSeconds(task),
      0,
    );
    return {
      efficiency:
        allottedSeconds > 0
          ? Math.round(
              (Math.min(actualSeconds, allottedSeconds) /
                Math.max(actualSeconds, allottedSeconds)) *
                100,
            )
          : 100,
    };
  }, [completedTasks]);

  const categoryProductivity = useMemo(() => {
    const counts = new Map<string, number>();
    completedTasks.forEach((task) => {
      const key = task.categoryId ?? "uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let topKey = "uncategorized";
    let topCount = 0;
    counts.forEach((count, key) => {
      if (count > topCount) {
        topKey = key;
        topCount = count;
      }
    });
    return {
      categoryName:
        topKey === "uncategorized"
          ? "Uncategorized"
          : categories.find((category) => category.id === topKey)?.name ??
            "Unknown",
      count: topCount,
    };
  }, [categories, completedTasks]);

  const peakWindow = useMemo(() => {
    const buckets = {
      Morning: 0,
      Afternoon: 0,
      Evening: 0,
      Night: 0,
    } as Record<string, number>;
    completedTasks.forEach((task) => {
      const source = task.completedAt ?? task.scheduledAt;
      const hour = new Date(source).getHours();
      if (hour >= 5 && hour <= 11) {
        buckets.Morning += 1;
      } else if (hour >= 12 && hour <= 16) {
        buckets.Afternoon += 1;
      } else if (hour >= 17 && hour <= 21) {
        buckets.Evening += 1;
      } else {
        buckets.Night += 1;
      }
    });
    let label = "Morning";
    let count = 0;
    Object.entries(buckets).forEach(([window, windowCount]) => {
      if (windowCount > count) {
        label = window;
        count = windowCount;
      }
    });

    return { label, count };
  }, [completedTasks]);

  const habitAdherence = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let index = 0; index < 30; index += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      days.push(toLocalDateKey(date));
    }
    let applicable = 0;
    let completed = 0;
    habits.forEach((habit) => {
      days.forEach((day) => {
        if (!habitAppliesToDate(habit, day)) {
          return;
        }
        applicable += 1;
        if (completionMap[habit.id]?.[day]) {
          completed += 1;
        }
      });
    });
    return {
      rate: applicable > 0 ? Math.round((completed / applicable) * 100) : 0,
    };
  }, [completionMap, habits]);

  const last7DaysCompleted = completedDateKeys.filter((key) => {
    const date = new Date(`${key}T00:00:00`);
    const diffDays = Math.floor(
      (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000),
    );
    return diffDays >= 0 && diffDays < 7;
  }).length;

  if (!tasksInitialized || !habitsInitialized || !categoriesInitialized) {
    return <LoadingScreen title="Loading profile" />;
  }

  const level = user?.current_level ?? 1;
  const xpIntoLevel = user?.xp_into_level ?? 0;
  const xpForNextLevel = user?.xp_for_next_level ?? 200;
  const levelProgress = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0;
  const displayName =
    user?.display_name?.trim() || user?.email?.split("@")[0] || "Guest";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] xl:items-start">
      <section className="min-w-0">
        <div
          className={cx(
            "relative px-7 pb-6 pt-6 text-center transition-all duration-500",
            entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
          )}
        >
          <h1 className="m-0 font-display text-[48px] leading-none tracking-[-1.5px] text-text">
            {displayName}
          </h1>
        </div>

        <div
          className={cx(
            "grid gap-2.5 px-7 pb-5 pt-2 transition-all delay-100 duration-500",
            entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[28px] tracking-[-1px] text-text">
              Lv.{level}
            </span>
            <div className="mt-4 inline-flex items-center gap-2">
              <AppIcon name="flame" size={24} color="var(--accent)" />
              <span className="font-sans-bold text-[24px] text-text">
                {currentStreak} day streak
              </span>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded bg-surface-light">
            <span
              className="block h-full rounded bg-accent"
              style={{
                width: `${Math.max(0, Math.min(100, levelProgress * 100))}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-sans-bold text-[14px] tracking-[-0.3px] text-text">
              {xpIntoLevel} / {xpForNextLevel} XP
            </span>
            <span className="font-sans-semibold text-[13px] text-muted-text">
              to level {level + 1}
            </span>
          </div>
        </div>

        <div
          className={cx(
            "px-7 transition-all delay-200 duration-500",
            entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
          )}
        >
          <h2 className="mb-1 mt-0 font-display text-[40px] tracking-[-0.5px] text-text">
            Stats
          </h2>

          <div>
            <StatRow
              label="Tasks completed"
              value={totalCompleted}
              icon="check-square"
            />
            <StatRow
              label="Completion rate"
              value={`${completionPct}%`}
              icon="percent"
            />
            <StatRow
              label="Best streak"
              value={`${bestStreak}d`}
              icon="flame-kindling"
            />
            <StatRow label="Active tasks" value={activeTasks} icon="square" />
            <StatRow
              label="Avg done/day (7d)"
              value={(last7DaysCompleted / 7).toFixed(1)}
              icon="calendar"
            />
            <StatRow
              label="Time efficiency"
              value={`${taskTimeStats.efficiency}%`}
              icon="target"
            />
            <StatRow
              label="Overdue tasks"
              value={overdueTasks}
              icon="alert-circle"
            />
            <StatRow
              label="Top category"
              value={categoryProductivity.count}
              icon="briefcase"
            />
            <StatRow label="Peak window" value={peakWindow.label} icon="sun" />
            <StatRow label="Habits" value={habits.length} icon="repeat" />
            <StatRow
              label="Habit rate (30d)"
              value={`${habitAdherence.rate}%`}
              icon="percent"
            />
          </div>
        </div>

        <div className="pointer-events-none mt-6 h-24 bg-gradient-to-t from-background via-background/95 to-transparent" />
      </section>

      <aside
        ref={settingsSectionRef}
        className={cx(
          "min-w-0 transition-all delay-150 duration-500",
          entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        )}
      >
        <SettingsPanel embedded />
      </aside>
    </div>
  );
}
