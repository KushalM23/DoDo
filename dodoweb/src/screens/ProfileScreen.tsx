import React, {useEffect, useMemo} from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {useAuth} from '@/providers/AuthContext';
import {useCategories} from '@/providers/CategoriesContext';
import {useHabits} from '@/providers/HabitsContext';
import {useTasks} from '@/providers/TasksContext';
import {habitAppliesToDate} from '@/utils/habits';
import {getTaskPlannedSeconds, getTaskTrackedSeconds} from '@/utils/taskTiming';
import {toLocalDateKey} from '@/utils/dateTime';

function calculateStreaks(completedDateKeys: string[]) {
  if (completedDateKeys.length === 0) {
    return {currentStreak: 0, bestStreak: 0};
  }

  const uniqueSorted = [...new Set(completedDateKeys)].sort();
  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00`);
    const current = new Date(`${uniqueSorted[i]}T00:00:00`);
    const daysDiff = Math.round((current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
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

  return {currentStreak, bestStreak};
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
    <div className="profile-stat-row">
      <div className="profile-stat-label">
        <AppIcon name={icon} size={18} color="var(--accent)" />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const {user, refreshUser} = useAuth();
  const {tasks, initialized: tasksInitialized} = useTasks();
  const {habits, initialized: habitsInitialized, loadHistory, completionMap} = useHabits();
  const {categories, initialized: categoriesInitialized} = useCategories();

  useEffect(() => {
    void refreshUser();
    void loadHistory({});
  }, [loadHistory, refreshUser]);

  const completedTasks = useMemo(() => tasks.filter(task => task.completed), [tasks]);
  const completedHabitDateKeys = useMemo(
    () =>
      Object.values(completionMap).flatMap(days =>
        Object.entries(days)
          .filter(([, completed]) => completed)
          .map(([date]) => date),
      ),
    [completionMap],
  );
  const completedDateKeys = useMemo(
    () =>
      completedTasks
        .map(task => toLocalDateKey(task.completedAt ?? task.scheduledAt))
        .concat(completedHabitDateKeys),
    [completedHabitDateKeys, completedTasks],
  );

  const {currentStreak, bestStreak} = useMemo(
    () => calculateStreaks(completedDateKeys),
    [completedDateKeys],
  );

  const totalTasks = tasks.length;
  const totalCompleted = completedTasks.length;
  const completionPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const activeTasks = tasks.filter(task => !task.completed).length;
  const overdueTasks = tasks.filter(task => !task.completed && new Date(task.deadline).getTime() < Date.now()).length;

  const taskTimeStats = useMemo(() => {
    const actualSeconds = completedTasks.reduce((sum, task) => sum + getTaskTrackedSeconds(task), 0);
    const allottedSeconds = completedTasks.reduce((sum, task) => sum + getTaskPlannedSeconds(task), 0);
    return {
      efficiency:
        allottedSeconds > 0
          ? Math.round((Math.min(actualSeconds, allottedSeconds) / Math.max(actualSeconds, allottedSeconds)) * 100)
          : 100,
    };
  }, [completedTasks]);

  const categoryProductivity = useMemo(() => {
    const counts = new Map<string, number>();
    completedTasks.forEach(task => {
      const key = task.categoryId ?? 'uncategorized';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let topKey = 'uncategorized';
    let topCount = 0;
    counts.forEach((count, key) => {
      if (count > topCount) {
        topKey = key;
        topCount = count;
      }
    });
    return {
      categoryName:
        topKey === 'uncategorized'
          ? 'Uncategorized'
          : categories.find(category => category.id === topKey)?.name ?? 'Unknown',
      count: topCount,
    };
  }, [categories, completedTasks]);

  const peakWindow = useMemo(() => {
    const buckets = {Morning: 0, Afternoon: 0, Evening: 0, Night: 0} as Record<string, number>;
    completedTasks.forEach(task => {
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
    return Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Morning';
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
    habits.forEach(habit => {
      days.forEach(day => {
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

  const last7DaysCompleted = completedDateKeys.filter(key => {
    const date = new Date(`${key}T00:00:00`);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays < 7;
  }).length;

  if (!tasksInitialized || !habitsInitialized || !categoriesInitialized) {
    return <LoadingScreen title="Loading profile" />;
  }

  const level = user?.current_level ?? 1;
  const xpIntoLevel = user?.xp_into_level ?? 0;
  const xpForNextLevel = user?.xp_for_next_level ?? 200;
  const levelProgress = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0;
  const displayName = user?.display_name?.trim() || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="page-grid profile-grid">
      <section className="desktop-panel">
        <div className="profile-hero">
          <button type="button" className="icon-button subtle profile-settings-btn" onClick={() => router.push('/settings')}>
            <AppIcon name="settings" size={20} color="var(--accent)" />
          </button>
          <h1>{displayName}</h1>
          <div className="profile-level-row">
            <strong>Lv.{level}</strong>
            <div className="profile-streak-pill">
              <AppIcon name="flame" size={20} color="var(--accent)" />
              <span>{currentStreak} day streak</span>
            </div>
          </div>
          <div className="progress-bar profile-xp-bar">
            <span style={{width: `${Math.round(levelProgress * 100)}%`}} />
          </div>
          <div className="profile-xp-row">
            <span>{xpIntoLevel} / {xpForNextLevel} XP</span>
            <span>to level {level + 1}</span>
          </div>
        </div>
      </section>

      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h2>Stats</h2>
            <p>Your recovered task and habit analytics.</p>
          </div>
        </div>

        <div className="profile-stats-list">
          <StatRow label="Tasks completed" value={totalCompleted} icon="check-square" />
          <StatRow label="Completion rate" value={`${completionPct}%`} icon="percent" />
          <StatRow label="Best streak" value={`${bestStreak}d`} icon="flame-kindling" />
          <StatRow label="Active tasks" value={activeTasks} icon="square" />
          <StatRow label="Avg done/day (7d)" value={(last7DaysCompleted / 7).toFixed(1)} icon="calendar" />
          <StatRow label="Time efficiency" value={`${taskTimeStats.efficiency}%`} icon="target" />
          <StatRow label="Overdue tasks" value={overdueTasks} icon="alert-circle" />
          <StatRow label="Top category" value={categoryProductivity.categoryName} icon="briefcase" />
          <StatRow label="Peak window" value={peakWindow} icon="sun" />
          <StatRow label="Habits" value={habits.length} icon="repeat" />
          <StatRow label="Habit rate (30d)" value={`${habitAdherence.rate}%`} icon="percent" />
        </div>
      </section>
    </div>
  );
}
