import {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
  type TriggerNotification,
} from '@notifee/react-native';
import notifee from '@notifee/react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';
import {handleNotificationNavigation} from '../navigation/navigationRef';
import {habitAppliesToDate} from '../utils/habits';
import type {Task} from '../types/task';
import type {Habit} from '../types/habit';

const DEFAULT_CHANNEL_ID = 'dodo-default';
const TASK_REMINDER_CHANNEL_ID = 'dodo-task-reminders';
const TASK_REMINDER_NOTIFICATION_PREFIX = 'task-reminder-';
const HABIT_REMINDER_NOTIFICATION_PREFIX = 'habit-reminder-';
const HABIT_REMINDER_LOOKAHEAD_DAYS = 14;

type NotificationContext = 'foreground' | 'background';

type NotificationData = Record<string, string>;

type ReminderNotificationDefinition = {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  data: NotificationData;
};

type ReminderSchedulePayload = {
  tasks: Task[];
  habits: Habit[];
  completionMap: Record<string, Record<string, boolean>>;
};

type RegisterNotificationOptions = {
  onToken?: (token: string) => Promise<void> | void;
};

let initialized = false;
let cachedToken: string | null = null;

function devLog(message: string, extra?: unknown): void {
  if (__DEV__) {
    // Keep logs concise to avoid noisy debugging output.
    console.log('[Notifications]', message, extra ?? '');
  }
}

function devWarn(message: string, error: unknown): void {
  if (__DEV__) {
    console.warn('[Notifications]', message, error);
  }
}

function getMessageData(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): NotificationData {
  const data: NotificationData = {};
  for (const [key, value] of Object.entries(remoteMessage.data ?? {})) {
    if (value != null) {
      data[key] = String(value);
    }
  }
  return data;
}

function getDisplayPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): {
  title: string;
  body: string;
  data: NotificationData;
  channelId: string;
} | null {
  const data = getMessageData(remoteMessage);
  const title =
    remoteMessage.notification?.title ?? data.title ?? data.notificationTitle;
  const body =
    remoteMessage.notification?.body ?? data.body ?? data.notificationBody;

  if (!title && !body) {
    return null;
  }

  const requestedChannel = data.channelId;
  const channelId =
    requestedChannel === TASK_REMINDER_CHANNEL_ID
      ? TASK_REMINDER_CHANNEL_ID
      : DEFAULT_CHANNEL_ID;

  return {
    title: title ?? 'DoDo Reminder',
    body: body ?? '',
    data,
    channelId,
  };
}

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  try {
    const current = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (current) {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    devWarn('Android notification permission request failed', error);
    return false;
  }
}

async function ensureAppleNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    await notifee.requestPermission();
    const status = await messaging().requestPermission();
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    devWarn('iOS notification permission request failed', error);
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const [androidAllowed, iosAllowed] = await Promise.all([
    ensureAndroidNotificationPermission(),
    ensureAppleNotificationPermission(),
  ]);
  return androidAllowed && iosAllowed;
}

export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: 'General Notifications',
    importance: AndroidImportance.DEFAULT,
  });

  await notifee.createChannel({
    id: TASK_REMINDER_CHANNEL_ID,
    name: 'Task Reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
    sound: 'default',
  });
}

function localDateKey(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromKeyAndMinute(dateKey: string, minute: number): Date {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Math.floor(minute / 60);
  const mins = minute % 60;
  return new Date(year, month - 1, day, hour, mins, 0, 0);
}

function isReminderNotificationId(id: string | undefined): boolean {
  if (!id) {
    return false;
  }
  return (
    id.startsWith(TASK_REMINDER_NOTIFICATION_PREFIX) ||
    id.startsWith(HABIT_REMINDER_NOTIFICATION_PREFIX)
  );
}

function buildTaskReminderDefinitions(
  tasks: Task[],
  nowMs: number,
): ReminderNotificationDefinition[] {
  const definitions: ReminderNotificationDefinition[] = [];

  for (const task of tasks) {
    if (task.completed) {
      continue;
    }

    const timestamp = Date.parse(task.scheduledAt);
    if (!Number.isFinite(timestamp) || timestamp <= nowMs) {
      continue;
    }

    definitions.push({
      id: `${TASK_REMINDER_NOTIFICATION_PREFIX}${task.id}`,
      title: task.title,
      body: 'Task time is now.',
      timestamp,
      data: {
        screen: 'TaskDetail',
        taskId: task.id,
      },
    });
  }

  return definitions;
}

function buildHabitReminderDefinitions(
  habits: Habit[],
  completionMap: Record<string, Record<string, boolean>>,
  now: Date,
): ReminderNotificationDefinition[] {
  const nowMs = now.getTime();
  const definitions: ReminderNotificationDefinition[] = [];

  for (const habit of habits) {
    if (habit.timeMinute == null) {
      continue;
    }

    for (
      let dayOffset = 0;
      dayOffset <= HABIT_REMINDER_LOOKAHEAD_DAYS;
      dayOffset += 1
    ) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + dayOffset);

      const dateKey = localDateKey(date);
      if (!habitAppliesToDate(habit, dateKey)) {
        continue;
      }

      if (completionMap[habit.id]?.[dateKey]) {
        continue;
      }

      const timestamp = dateFromKeyAndMinute(
        dateKey,
        habit.timeMinute,
      ).getTime();
      if (!Number.isFinite(timestamp) || timestamp <= nowMs) {
        continue;
      }

      definitions.push({
        id: `${HABIT_REMINDER_NOTIFICATION_PREFIX}${habit.id}-${dateKey}`,
        title: habit.title,
        body: 'Habit time is now.',
        timestamp,
        data: {
          screen: 'HabitDetail',
          habitId: habit.id,
          date: dateKey,
        },
      });
    }
  }

  return definitions;
}

async function cancelStaleReminderTriggers(
  existingTriggers: TriggerNotification[],
  desiredIds: Set<string>,
): Promise<void> {
  const staleIds = existingTriggers
    .map(item => item.notification.id)
    .filter((id): id is string =>
      Boolean(id && isReminderNotificationId(id) && !desiredIds.has(id)),
    );

  await Promise.all(staleIds.map(id => notifee.cancelNotification(id)));
}

export async function clearLocalReminderSchedules(): Promise<void> {
  const existingTriggers = await notifee.getTriggerNotifications();
  const reminderIds = existingTriggers
    .map(item => item.notification.id)
    .filter((id): id is string => Boolean(id && isReminderNotificationId(id)));

  await Promise.all(reminderIds.map(id => notifee.cancelNotification(id)));
}

async function scheduleReminderDefinition(
  definition: ReminderNotificationDefinition,
): Promise<void> {
  await notifee.createTriggerNotification(
    {
      id: definition.id,
      title: definition.title,
      body: definition.body,
      data: definition.data,
      android: {
        channelId: TASK_REMINDER_CHANNEL_ID,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.HIGH,
      },
      ios: {
        foregroundPresentationOptions: {
          badge: true,
          sound: true,
          banner: true,
          list: true,
        },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: definition.timestamp,
    },
  );
}

export async function syncLocalReminderSchedules(
  payload: ReminderSchedulePayload,
): Promise<void> {
  await createNotificationChannels();

  const now = new Date();
  const nowMs = now.getTime();

  const taskDefinitions = buildTaskReminderDefinitions(payload.tasks, nowMs);
  const habitDefinitions = buildHabitReminderDefinitions(
    payload.habits,
    payload.completionMap,
    now,
  );

  const allDefinitions = [...taskDefinitions, ...habitDefinitions];
  const desiredIds = new Set(allDefinitions.map(item => item.id));

  const existingTriggers = await notifee.getTriggerNotifications();
  await cancelStaleReminderTriggers(existingTriggers, desiredIds);

  await Promise.all(
    allDefinitions.map(definition => scheduleReminderDefinition(definition)),
  );
}

async function displayRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  context: NotificationContext,
): Promise<void> {
  const payload = getDisplayPayload(remoteMessage);
  if (!payload) {
    devLog('Skipped notification display due to empty payload', remoteMessage);
    return;
  }

  const hasSystemNotificationPayload = Boolean(
    remoteMessage.notification?.title || remoteMessage.notification?.body,
  );

  if (context === 'background' && hasSystemNotificationPayload) {
    // Avoid duplicate system + local notifications when Firebase already contains a notification payload.
    devLog(
      'Skipped background local display to avoid duplicates',
      remoteMessage.messageId,
    );
    return;
  }

  await notifee.displayNotification({
    id: remoteMessage.messageId ?? undefined,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    android: {
      channelId: payload.channelId,
      pressAction: {
        id: 'default',
      },
      smallIcon: 'ic_launcher',
      importance:
        payload.channelId === TASK_REMINDER_CHANNEL_ID
          ? AndroidImportance.HIGH
          : AndroidImportance.DEFAULT,
    },
    ios: {
      foregroundPresentationOptions: {
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });
}

function handlePressedNotificationData(
  data: NotificationData | undefined,
): void {
  if (!data) {
    return;
  }

  handleNotificationNavigation(data);
}

function handleNotifeeEvent(event: Event): void {
  if (event.type === EventType.PRESS || event.type === EventType.ACTION_PRESS) {
    const data = event.detail.notification?.data as
      | NotificationData
      | undefined;
    handlePressedNotificationData(data);
  }
}

export async function getCurrentFcmToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    cachedToken = await messaging().getToken();
    return cachedToken;
  } catch (error) {
    devWarn('Unable to fetch FCM token', error);
    return null;
  }
}

export async function registerNotificationHandlers(
  options: RegisterNotificationOptions = {},
): Promise<() => void> {
  if (initialized) {
    return () => undefined;
  }

  initialized = true;

  await createNotificationChannels();
  await requestNotificationPermission();

  const currentToken = await getCurrentFcmToken();
  if (currentToken) {
    await options.onToken?.(currentToken);
  }

  const onMessageUnsubscribe = messaging().onMessage(async remoteMessage => {
    try {
      await displayRemoteMessage(remoteMessage, 'foreground');
    } catch (error) {
      devWarn('Unable to display foreground notification', error);
    }
  });

  const onTokenRefreshUnsubscribe = messaging().onTokenRefresh(async token => {
    cachedToken = token;
    try {
      await options.onToken?.(token);
    } catch (error) {
      devWarn('FCM token refresh callback failed', error);
    }
  });

  const onOpenFromBackgroundUnsubscribe = messaging().onNotificationOpenedApp(
    remoteMessage => {
      if (!remoteMessage) {
        return;
      }
      handlePressedNotificationData(getMessageData(remoteMessage));
    },
  );

  const onForegroundEventUnsubscribe =
    notifee.onForegroundEvent(handleNotifeeEvent);

  try {
    const initialMessagingNotification =
      await messaging().getInitialNotification();
    if (initialMessagingNotification) {
      handlePressedNotificationData(
        getMessageData(initialMessagingNotification),
      );
    }
  } catch (error) {
    devWarn('Unable to read initial Firebase notification', error);
  }

  try {
    const initialNotifeeNotification = await notifee.getInitialNotification();
    if (initialNotifeeNotification?.notification?.data) {
      handlePressedNotificationData(
        initialNotifeeNotification.notification.data as NotificationData,
      );
    }
  } catch (error) {
    devWarn('Unable to read initial Notifee notification', error);
  }

  return () => {
    onMessageUnsubscribe();
    onTokenRefreshUnsubscribe();
    onOpenFromBackgroundUnsubscribe();
    onForegroundEventUnsubscribe();
    initialized = false;
  };
}

export async function handleBackgroundRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  try {
    await createNotificationChannels();
    await displayRemoteMessage(remoteMessage, 'background');
  } catch (error) {
    devWarn('Unable to handle background remote message', error);
  }
}

export function handleBackgroundNotificationPress(
  data: NotificationData | undefined,
): void {
  handlePressedNotificationData(data);
}
