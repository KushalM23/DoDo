import { requestWidgetUpdate, ColorProp } from 'react-native-android-widget';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeLocalDb, query } from '../lib/local/db';
import { habitAppliesToDate, isHabitPausedOnDate } from '../utils/habits';
import { toLocalDateKey, formatTime } from '../utils/dateTime';
import { DodoWeekWidget, WidgetDay, WidgetItem } from './DodoWeekWidget';
import { DodoMonthWidget } from './DodoMonthWidget';
import { buildMonthCells } from '../screens/calendar/utils';
import { formatCalendarTriggerLabel2 } from '../components/overlays/dateWheelPickerUtils';

const SELECTED_DATE_KEY_PREFIX = '@dodo/widget_selected_date:';

export async function getSelectedDate(widgetId: number): Promise<string> {
  const date = await AsyncStorage.getItem(`${SELECTED_DATE_KEY_PREFIX}${widgetId}`);
  if (date) {
    return date;
  }
  return toLocalDateKey(new Date());
}

export async function setSelectedDate(widgetId: number, date: string): Promise<void> {
  await AsyncStorage.setItem(`${SELECTED_DATE_KEY_PREFIX}${widgetId}`, date);
}

function getStartOfWeek(date: Date, weekStart: 'sunday' | 'monday'): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff =
    d.getDate() -
    day +
    (day === 0 && weekStart === 'monday' ? -6 : weekStart === 'monday' ? 1 : 0);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

const darkColors = {
  background: '#000000' as ColorProp,
  surface: '#111111' as ColorProp,
  surfaceLight: '#1A1A1A' as ColorProp,
  text: '#F5F5F5' as ColorProp,
  textSecondary: '#D0D0D0' as ColorProp,
  mutedText: '#666666' as ColorProp,
  border: '#1E1E1E' as ColorProp,
  accent: '#E8651A' as ColorProp,
  highPriority: '#E5484D' as ColorProp,
  mediumPriority: '#F5A623' as ColorProp,
  lowPriority: '#30A46C' as ColorProp,
  habitBadge: '#8B5CF6' as ColorProp,
};

const lightColors = {
  background: '#FFFFFF' as ColorProp,
  surface: '#F7F7F7' as ColorProp,
  surfaceLight: '#F0F0F0' as ColorProp,
  text: '#0A0A0A' as ColorProp,
  textSecondary: '#1A1A1A' as ColorProp,
  mutedText: '#888888' as ColorProp,
  border: '#E8E8E8' as ColorProp,
  accent: '#D85A12' as ColorProp,
  highPriority: '#D92D20' as ColorProp,
  mediumPriority: '#F5A623' as ColorProp,
  lowPriority: '#13795B' as ColorProp,
  habitBadge: '#6D4BD8' as ColorProp,
};

export async function buildWidgetRepresentation(widgetId: number, widgetName: string = 'DodoWeekWidget') {
  // 1. Read userId and preferences
  const authUserRaw = await AsyncStorage.getItem('@dodo/auth_user');
  const user = authUserRaw ? JSON.parse(authUserRaw) : null;
  const userId = user?.id;

  const prefsRaw = await AsyncStorage.getItem('@dodo/preferences');
  const preferences = prefsRaw
    ? JSON.parse(prefsRaw)
    : { darkMode: true, weekStart: 'monday', timeFormat: '12h' };

  const isDark = preferences.darkMode !== false;
  const colors = isDark ? darkColors : lightColors;
  const weekStart = preferences.weekStart || 'monday';

  // 2. Read selectedDate
  const selectedDate = await getSelectedDate(widgetId);

  // 3. Build week days row
  const weekStartD = getStartOfWeek(new Date(selectedDate + 'T00:00:00'), weekStart);
  const days: WidgetDay[] = [];
  const weekdayInitials =
    weekStart === 'monday'
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayKey = toLocalDateKey(new Date());

  for (let idx = 0; idx < 7; idx++) {
    const date = new Date(
      weekStartD.getFullYear(),
      weekStartD.getMonth(),
      weekStartD.getDate() + idx
    );
    const dateKey = toLocalDateKey(date);
    days.push({
      dateKey,
      dayInitial: weekdayInitials[idx],
      dayNum: date.getDate(),
      isToday: dateKey === todayKey,
    });
  }

  let tasks: WidgetItem[] = [];
  let habits: WidgetItem[] = [];

  if (userId) {
    // 4. Initialize local SQLite DB and query tasks
    await initializeLocalDb();

    const dayStartD = new Date(selectedDate + 'T00:00:00');
    const dayEndD = new Date(dayStartD.getTime() + 24 * 60 * 60 * 1000);

    const tasksRows = await query<any>(
      `SELECT t.*, c.color AS category_color, c.icon AS category_icon 
       FROM tasks_local t
       LEFT JOIN categories_local c ON t.category_id = c.id AND t.user_id = c.user_id
       WHERE t.user_id = ? AND t.deleted_at IS NULL`,
      [userId]
    );

    const filteredTasks = tasksRows.filter((row) => {
      const start = new Date(row.scheduled_at);
      const end = new Date(row.deadline);
      return start < dayEndD && end > dayStartD;
    });

    tasks = filteredTasks.map((row) => {
      let timeLabel = '';
      let timeMs = 0;
      if (row.scheduled_at) {
        const timeDate = new Date(row.scheduled_at);
        timeLabel = formatTime(timeDate, preferences.timeFormat || '12h');
        timeMs = timeDate.getTime();
      }
      return {
        id: row.id,
        title: row.title,
        completed: Boolean(row.completed),
        priority: row.priority,
        timeLabel,
        timeMs,
        isHabit: false,
        categoryColor: row.category_color,
        categoryIcon: row.category_icon,
      };
    });

    // 5. Query habits and completions
    const habitsRows = await query<any>(
      `SELECT * FROM habits_local 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY created_at ASC`,
      [userId]
    );

    const completionsRows = await query<{ habit_id: string }>(
      `SELECT habit_id FROM habit_completions_local 
       WHERE user_id = ? AND completed_on = ? AND completed = 1`,
      [userId, selectedDate]
    );
    const completedHabitIds = new Set(completionsRows.map((r) => r.habit_id));

    for (const row of habitsRows) {
      const habit = {
        id: row.id,
        title: row.title,
        icon: row.icon,
        frequencyType: row.frequency_type,
        intervalDays: row.interval_days,
        customDays: row.custom_days_json ? JSON.parse(row.custom_days_json) : [],
        timeMinute: row.time_minute,
        durationMinutes: row.duration_minutes,
        anchorDate: row.anchor_date,
        isPaused: row.is_paused === 1,
        pausedUntil: row.paused_until,
        createdAt: row.created_at,
      } as any;

      if (habitAppliesToDate(habit, selectedDate) && !isHabitPausedOnDate(habit, selectedDate)) {
        let timeLabel = '';
        let timeMs = 0;
        if (habit.timeMinute != null) {
          const hours = Math.floor(habit.timeMinute / 60);
          const mins = habit.timeMinute % 60;
          const date = new Date(selectedDate + 'T00:00:00');
          date.setHours(hours, mins, 0, 0);
          timeLabel = formatTime(date, preferences.timeFormat || '12h');
          timeMs = date.getTime();
        } else {
          timeMs = new Date(selectedDate + 'T00:00:00').getTime();
        }
        habits.push({
          id: habit.id,
          title: habit.title,
          completed: completedHabitIds.has(habit.id),
          timeLabel,
          timeMs,
          isHabit: true,
          icon: habit.icon,
        });
      }
    }
  }

  const combinedItems = [...tasks, ...habits].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.timeMs - b.timeMs;
  });

  if (widgetName === 'DodoMonthWidget') {
    const selectedDateD = new Date(selectedDate + 'T00:00:00');
    const cells = buildMonthCells(selectedDateD, weekStart);
    const widgetDays = cells.map((cell) => ({
      dateKey: cell.dateKey,
      dayNum: cell.dayNum,
      isToday: cell.isToday,
      inCurrentMonth: cell.inCurrentMonth,
    }));
    const monthLabel = formatCalendarTriggerLabel2(selectedDateD);
    const weekdayInitials =
      weekStart === 'monday'
        ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return React.createElement(DodoMonthWidget, {
      monthLabel,
      weekdayInitials,
      days: widgetDays,
      selectedDate,
      items: combinedItems,
      colors,
    });
  }

  return React.createElement(DodoWeekWidget, {
    days,
    selectedDate,
    items: combinedItems,
    colors,
  });
}

export function requestDodoWeekWidgetUpdate() {
  requestWidgetUpdate({
    widgetName: 'DodoWeekWidget',
    renderWidget: (props) => buildWidgetRepresentation(props.widgetId, 'DodoWeekWidget'),
  }).catch((err) => {
    console.error('[widgetUpdater] Error requesting widget update:', err);
  });
}

export function requestDodoMonthWidgetUpdate() {
  requestWidgetUpdate({
    widgetName: 'DodoMonthWidget',
    renderWidget: (props) => buildWidgetRepresentation(props.widgetId, 'DodoMonthWidget'),
  }).catch((err) => {
    console.error('[widgetUpdater] Error requesting widget update:', err);
  });
}
