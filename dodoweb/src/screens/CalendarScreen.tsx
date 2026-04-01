import React, {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {useAuth} from '@/providers/AuthContext';
import {useHabits} from '@/providers/HabitsContext';
import {usePreferences} from '@/providers/PreferencesContext';
import {readDb} from '@/lib/local/db';
import {runSync} from '@/lib/local/syncEngine';
import {habitAppliesToDate} from '@/utils/habits';
import {getCalendarOffset, getWeekdayLabels, toLocalDateKey} from '@/utils/dateTime';
import type {Task} from '@/types/task';
import type {Habit} from '@/types/habit';

type TimelineEvent = {
  id: string;
  title: string;
  timeLabel: string;
  completed: boolean;
  isHabit: boolean;
  taskId?: string;
  habitId?: string;
};

function buildMonthCells(month: Date, weekStart: 'sunday' | 'monday') {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstOffset = getCalendarOffset(monthStart.getDay(), weekStart);
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstOffset);
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = toLocalDateKey(date);
    cells.push({
      key: `${dateKey}-${index}`,
      date,
      dateKey,
      dayNum: date.getDate(),
      inCurrentMonth:
        date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
      isToday: dateKey === toLocalDateKey(new Date()),
    });
  }
  return cells;
}

function monthWindow(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
  return {startAt: start.toISOString(), endAt: end.toISOString()};
}

function taskStatusByDate(tasks: Task[]) {
  const bucket: Record<string, {total: number; completed: number}> = {};
  tasks.forEach(task => {
    const key = toLocalDateKey(task.scheduledAt);
    if (!bucket[key]) {
      bucket[key] = {total: 0, completed: 0};
    }
    bucket[key].total += 1;
    if (task.completed) {
      bucket[key].completed += 1;
    }
  });
  return Object.fromEntries(
    Object.entries(bucket).map(([key, value]) => [
      key,
      value.completed === value.total ? 'done' : 'partial',
    ]),
  );
}

function habitStatusByDate(
  habits: Habit[],
  dates: string[],
  completionMap: Record<string, Record<string, boolean>>,
) {
  return Object.fromEntries(
    dates.map(dateKey => {
      const applies = habits.filter(habit => habitAppliesToDate(habit, dateKey));
      if (applies.length === 0) {
        return [dateKey, 'none'];
      }
      const completed = applies.filter(habit => completionMap[habit.id]?.[dateKey]).length;
      return [dateKey, completed === applies.length ? 'done' : 'partial'];
    }),
  );
}

export function CalendarScreen() {
  const router = useRouter();
  const {user} = useAuth();
  const {habits, completionMap, loadHistory} = useHabits();
  const {preferences} = usePreferences();
  const userId = user?.id ?? null;

  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey(today));
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!userId) {
      setMonthTasks([]);
      return;
    }
    const activeUserId = userId;

    const {startAt, endAt} = monthWindow(currentDate);
    let cancelled = false;

    async function load() {
      const localTasks = await readDb(db =>
        (db.tasks[activeUserId] ?? [])
          .filter((task: Task) => !task.deletedAt)
          .filter((task: Task) => task.scheduledAt >= startAt && task.scheduledAt < endAt),
      );
      if (!cancelled) {
        setMonthTasks(localTasks);
      }
      const didSync = await runSync(activeUserId, 'manual');
      if (!didSync || cancelled) {
        return;
      }
      const reconciledTasks = await readDb(db =>
        (db.tasks[activeUserId] ?? [])
          .filter((task: Task) => !task.deletedAt)
          .filter((task: Task) => task.scheduledAt >= startAt && task.scheduledAt < endAt),
      );
      if (!cancelled) {
        setMonthTasks(reconciledTasks);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentDate, userId]);

  const allMonthCells = useMemo(
    () => buildMonthCells(currentDate, preferences.weekStart),
    [currentDate, preferences.weekStart],
  );

  useEffect(() => {
    if (allMonthCells.length === 0) {
      return;
    }
    const startDate = allMonthCells[0].dateKey;
    const endDate = allMonthCells[allMonthCells.length - 1].dateKey;
    void loadHistory({startDate, endDate});
  }, [allMonthCells, loadHistory]);

  const visibleCells = useMemo(() => {
    if (mode === 'month') {
      return allMonthCells;
    }
    const currentIndex = allMonthCells.findIndex(cell => cell.dateKey === selectedDate);
    const weekIndex = currentIndex >= 0 ? Math.floor(currentIndex / 7) : 0;
    return allMonthCells.slice(weekIndex * 7, weekIndex * 7 + 7);
  }, [allMonthCells, mode, selectedDate]);

  const statusMap = useMemo(() => taskStatusByDate(monthTasks), [monthTasks]);
  const habitStatusMap = useMemo(
    () => habitStatusByDate(habits, allMonthCells.map(cell => cell.dateKey), completionMap),
    [allMonthCells, completionMap, habits],
  );

  const tasksForSelectedDate: TimelineEvent[] = useMemo(() => {
    const taskEvents = monthTasks
      .filter(task => toLocalDateKey(new Date(task.scheduledAt)) === selectedDate)
      .map(task => ({
        id: task.id,
        title: task.title,
        timeLabel: new Date(task.scheduledAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }),
        completed: task.completed,
        isHabit: false,
        taskId: task.id,
      }));

    const habitEvents = habits
      .filter(habit => habitAppliesToDate(habit, selectedDate))
      .map(habit => ({
        id: `habit_${habit.id}_${selectedDate}`,
        title: habit.title,
        timeLabel: habit.timeMinute != null
          ? new Date(2000, 0, 1, Math.floor(habit.timeMinute / 60), habit.timeMinute % 60).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Any time',
        completed: !!completionMap[habit.id]?.[selectedDate],
        isHabit: true,
        habitId: habit.id,
      }));

    return [...taskEvents, ...habitEvents].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
  }, [completionMap, habits, monthTasks, selectedDate]);

  return (
    <div className="page-grid calendar-grid">
      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h1>Calendar</h1>
            <p>Weekly and monthly scheduling overview.</p>
          </div>
          <div className="row-actions">
            <button type="button" className={`chip ${mode === 'week' ? 'active' : ''}`} onClick={() => setMode('week')}>
              Week
            </button>
            <button type="button" className={`chip ${mode === 'month' ? 'active' : ''}`} onClick={() => setMode('month')}>
              Month
            </button>
          </div>
        </div>

        <div className="calendar-header">
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => {
              const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
              setCurrentDate(nextDate);
              setSelectedDate(toLocalDateKey(nextDate));
            }}>
            <AppIcon name="chevron-left" size={18} />
          </button>
          <h2>
            {currentDate.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
          </h2>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => {
              const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
              setCurrentDate(nextDate);
              setSelectedDate(toLocalDateKey(nextDate));
            }}>
            <AppIcon name="chevron-right" size={18} />
          </button>
        </div>

        <div className="calendar-weekdays">
          {getWeekdayLabels(preferences.weekStart).map(day => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-cell-grid">
          {visibleCells.map(cell => {
            const taskStatus = statusMap[cell.dateKey] ?? 'none';
            const habitStatus = habitStatusMap[cell.dateKey] ?? 'none';
            return (
              <button
                key={cell.key}
                type="button"
                className={`calendar-cell ${cell.dateKey === selectedDate ? 'selected' : ''} ${
                  cell.isToday ? 'today' : ''
                } ${!cell.inCurrentMonth && mode === 'month' ? 'muted' : ''}`}
                onClick={() => {
                  setSelectedDate(cell.dateKey);
                  setCurrentDate(cell.date);
                }}>
                <strong>{cell.dayNum}</strong>
                <div className="calendar-status-row">
                  {taskStatus !== 'none' ? <span className={`status-dot ${taskStatus}`} /> : null}
                  {habitStatus !== 'none' ? <span className={`status-dot habit ${habitStatus}`} /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h2>Timeline</h2>
            <p>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}</p>
          </div>
        </div>

        <div className="timeline-list">
          {tasksForSelectedDate.map(event => (
            <article
              key={event.id}
              className={`timeline-card ${event.completed ? 'completed' : ''} ${
                event.isHabit ? 'habit' : 'task'
              }`}
              onClick={() =>
                router.push(event.isHabit && event.habitId ? `/habits/${event.habitId}` : `/tasks/${event.taskId}`)
              }>
              <div>
                <h3>{event.title}</h3>
                <p>{event.timeLabel}</p>
              </div>
              <AppIcon name={event.isHabit ? 'repeat' : 'check-square'} size={18} />
            </article>
          ))}

          {tasksForSelectedDate.length === 0 ? (
            <div className="empty-block">
              <h3>Nothing scheduled</h3>
              <p>No tasks or habits for this date.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
