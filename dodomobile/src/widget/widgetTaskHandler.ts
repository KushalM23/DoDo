import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeLocalDb, query } from '../lib/local/db';
import { updateTaskLocal, setHabitCompletedLocal } from '../lib/local/repository';
import { runSync } from '../lib/local/syncEngine';
import {
  buildWidgetRepresentation,
  getSelectedDate,
  setSelectedDate,
} from './widgetUpdater';

async function renderWidgetUI(widgetId: number, widgetName: string, renderWidgetFn: any) {
  try {
    const representation = await buildWidgetRepresentation(widgetId, widgetName);
    renderWidgetFn(representation);
  } catch (error) {
    console.error('[widgetTaskHandler] Error rendering widget:', error);
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, clickAction, clickActionData, widgetInfo } = props;
  const widgetId = widgetInfo.widgetId;
  const widgetName = widgetInfo.widgetName;

  if (
    widgetAction === 'WIDGET_ADDED' ||
    widgetAction === 'WIDGET_UPDATE' ||
    widgetAction === 'WIDGET_RESIZED'
  ) {
    await renderWidgetUI(widgetId, widgetName, props.renderWidget);
  } else if (widgetAction === 'WIDGET_CLICK') {
    switch (clickAction) {
      case 'SELECT_DATE': {
        const date = clickActionData?.date;
        if (typeof date === 'string') {
          await setSelectedDate(widgetId, date);
        }
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'TOGGLE_TASK': {
        const taskId = clickActionData?.id;
        if (typeof taskId === 'string') {
          const authUserRaw = await AsyncStorage.getItem('@dodo/auth_user');
          const user = authUserRaw ? JSON.parse(authUserRaw) : null;
          if (user?.id) {
            await initializeLocalDb();
            const [taskRow] = await query<any>(
              'SELECT completed FROM tasks_local WHERE user_id = ? AND id = ? LIMIT 1',
              [user.id, taskId]
            );
            if (taskRow) {
              const nextCompleted = !taskRow.completed;
              await updateTaskLocal(user.id, taskId, { completed: nextCompleted });
            }
          }
        }
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'TOGGLE_HABIT': {
        const habitId = clickActionData?.id;
        if (typeof habitId === 'string') {
          const authUserRaw = await AsyncStorage.getItem('@dodo/auth_user');
          const user = authUserRaw ? JSON.parse(authUserRaw) : null;
          if (user?.id) {
            await initializeLocalDb();
            const selectedDate = await getSelectedDate(widgetId);
            const completionRows = await query<any>(
              'SELECT completed FROM habit_completions_local WHERE user_id = ? AND habit_id = ? AND completed_on = ? LIMIT 1',
              [user.id, habitId, selectedDate]
            );
            const completed = completionRows[0]?.completed === 1;
            await setHabitCompletedLocal({
              userId: user.id,
              habitId,
              date: selectedDate,
              completed: !completed,
            });
          }
        }
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }


      case 'REFRESH_WIDGET': {
        const authUserRaw = await AsyncStorage.getItem('@dodo/auth_user');
        const user = authUserRaw ? JSON.parse(authUserRaw) : null;
        if (user?.id) {
          await runSync(user.id, 'manual').catch((err) => {
            console.error('[widgetTaskHandler] Error during sync on refresh:', err);
          });
        }
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'PREV_WEEK': {
        const selectedDate = await getSelectedDate(widgetId);
        const newDate = shiftDateByDays(selectedDate, -7);
        await setSelectedDate(widgetId, newDate);
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'NEXT_WEEK': {
        const selectedDate = await getSelectedDate(widgetId);
        const newDate = shiftDateByDays(selectedDate, 7);
        await setSelectedDate(widgetId, newDate);
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'PREV_MONTH': {
        const selectedDate = await getSelectedDate(widgetId);
        const newDate = shiftMonthDate(selectedDate, -1);
        await setSelectedDate(widgetId, newDate);
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }

      case 'NEXT_MONTH': {
        const selectedDate = await getSelectedDate(widgetId);
        const newDate = shiftMonthDate(selectedDate, 1);
        await setSelectedDate(widgetId, newDate);
        await renderWidgetUI(widgetId, widgetName, props.renderWidget);
        break;
      }
    }
  }
}

function shiftDateByDays(dateKey: string, days: number): string {
  const date = new Date(dateKey + 'T00:00:00');
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftMonthDate(dateKey: string, delta: number): string {
  const currentDate = new Date(dateKey + 'T00:00:00');
  const targetMonthDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + delta,
    1
  );

  const today = new Date();
  const isTodayMonth =
    targetMonthDate.getMonth() === today.getMonth() &&
    targetMonthDate.getFullYear() === today.getFullYear();

  if (isTodayMonth) {
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } else {
    const yyyy = targetMonthDate.getFullYear();
    const mm = String(targetMonthDate.getMonth() + 1).padStart(2, '0');
    const dd = '01';
    return `${yyyy}-${mm}-${dd}`;
  }
}
