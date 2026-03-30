import {createNavigationContainerRef} from '@react-navigation/native';
import type {RootStackParamList} from './RootNavigator';

const MAIN_TAB_KEYS = new Set([
  'TasksTab',
  'HabitTab',
  'CalendarTab',
  'ProfileTab',
]);

type NotificationNavigationData = Record<string, string | undefined>;

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingNavigationData: NotificationNavigationData | null = null;

function navigateFromData(data: NotificationNavigationData): boolean {
  const screen = data.screen;
  const openFocus =
    data.openFocus === '1' ||
    data.openFocus?.toLowerCase() === 'true' ||
    data.openFocus?.toLowerCase() === 'yes';

  if (screen === 'TaskDetail' && data.taskId) {
    navigationRef.navigate('TaskDetail', {
      taskId: data.taskId,
      openFocus,
    });
    return true;
  }

  if (screen === 'HabitDetail' && data.habitId) {
    navigationRef.navigate('HabitDetail', {
      habitId: data.habitId,
      openFocus,
    });
    return true;
  }

  if (screen === 'Settings') {
    navigationRef.navigate('Settings');
    return true;
  }

  if (screen === 'Main') {
    navigationRef.navigate('Main');
    return true;
  }

  if (screen && MAIN_TAB_KEYS.has(screen)) {
    navigationRef.navigate('Main');
    return true;
  }

  if (data.taskId) {
    navigationRef.navigate('TaskDetail', {
      taskId: data.taskId,
      openFocus,
    });
    return true;
  }

  if (data.habitId) {
    navigationRef.navigate('HabitDetail', {
      habitId: data.habitId,
      openFocus,
    });
    return true;
  }

  return false;
}

export function handleNotificationNavigation(
  data: NotificationNavigationData | null | undefined,
): boolean {
  if (!data) {
    return false;
  }

  if (!navigationRef.isReady()) {
    pendingNavigationData = data;
    return false;
  }

  pendingNavigationData = null;
  return navigateFromData(data);
}

export function flushPendingNotificationNavigation(): void {
  if (!pendingNavigationData || !navigationRef.isReady()) {
    return;
  }

  const data = pendingNavigationData;
  pendingNavigationData = null;
  navigateFromData(data);
}
