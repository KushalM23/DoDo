import {useEffect} from 'react';
import {useAuth} from './AuthContext';
import {useTasks} from './TasksContext';
import {useHabits} from './HabitsContext';
import {
  clearLocalReminderSchedules,
  syncLocalReminderSchedules,
} from '../services/notifications';

function devWarn(message: string, error: unknown): void {
  if (__DEV__) {
    console.warn('[ReminderScheduleBootstrap]', message, error);
  }
}

export function ReminderScheduleBootstrap() {
  const {user} = useAuth();
  const {tasks, initialized: tasksInitialized} = useTasks();
  const {habits, completionMap, initialized: habitsInitialized} = useHabits();

  useEffect(() => {
    if (!user?.id) {
      void clearLocalReminderSchedules().catch(error => {
        devWarn('Unable to clear local reminder schedules', error);
      });
      return;
    }

    if (!tasksInitialized || !habitsInitialized) {
      return;
    }

    const timeout = setTimeout(() => {
      void syncLocalReminderSchedules({
        userId: user.id,
        tasks,
        habits,
        completionMap,
      }).catch(error => {
        devWarn('Unable to synchronize local reminder schedules', error);
      });
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    completionMap,
    habits,
    habitsInitialized,
    tasks,
    tasksInitialized,
    user?.id,
  ]);

  return null;
}
