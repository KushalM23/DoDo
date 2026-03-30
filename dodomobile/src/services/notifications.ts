import {
  AndroidImportance,
  AndroidStyle,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
  type Notification,
  type TriggerNotification,
} from '@notifee/react-native';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';
import {runSync} from '../lib/local/syncEngine';
import {setHabitCompletedLocal, updateTaskLocal} from '../lib/local/repository';
import {handleNotificationNavigation} from '../navigation/navigationRef';
import {habitAppliesToDate} from '../utils/habits';
import type {Task} from '../types/task';
import type {Habit} from '../types/habit';

const DEFAULT_CHANNEL_ID = 'dodo-default';
const TASK_REMINDER_CHANNEL_ID = 'dodo-task-reminders';
const REMINDER_ACTIONS_CATEGORY_ID = 'dodo-reminder-actions';
const REMINDER_ACTION_LOCK_IN = 'lock_in';
const REMINDER_ACTION_COMPLETE = 'complete';
const REMINDER_ACTION_SNOOZE = 'snooze';
const TASK_REMINDER_NOTIFICATION_PREFIX = 'task-reminder-';
const HABIT_REMINDER_NOTIFICATION_PREFIX = 'habit-reminder-';
const TASK_SNOOZE_NOTIFICATION_PREFIX = 'task-snooze-';
const HABIT_SNOOZE_NOTIFICATION_PREFIX = 'habit-snooze-';
const PREFERENCES_KEY = '@dodo/preferences';
const AUTH_USER_KEY = '@dodo/auth_user';
const DEFAULT_SNOOZE_MINUTES = 5;
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
  userId: string;
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
    isScheduledReminderNotificationId(id) || isSnoozedReminderNotificationId(id)
  );
}

function isScheduledReminderNotificationId(id: string): boolean {
  return (
    id.startsWith(TASK_REMINDER_NOTIFICATION_PREFIX) ||
    id.startsWith(HABIT_REMINDER_NOTIFICATION_PREFIX)
  );
}

function isSnoozedReminderNotificationId(id: string): boolean {
  return (
    id.startsWith(TASK_SNOOZE_NOTIFICATION_PREFIX) ||
    id.startsWith(HABIT_SNOOZE_NOTIFICATION_PREFIX)
  );
}

function isReminderData(data: NotificationData | undefined): boolean {
  if (!data) {
    return false;
  }
  return Boolean(data.taskId || data.habitId);
}

function getReminderAndroidActions() {
  return [
    {
      title: 'Lock in',
      pressAction: {
        id: REMINDER_ACTION_LOCK_IN,
        launchActivity: 'default' as const,
      },
    },
    {
      title: 'Complete',
      pressAction: {
        id: REMINDER_ACTION_COMPLETE,
      },
    },
    {
      title: 'Snooze',
      pressAction: {
        id: REMINDER_ACTION_SNOOZE,
      },
    },
  ];
}

function getReminderAndroidStyle(title: string) {
  return {
    type: AndroidStyle.BIGTEXT as const,
    text: title,
  };
}

function buildTaskReminderDefinitions(
  userId: string,
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
      body: '',
      timestamp,
      data: {
        screen: 'TaskDetail',
        taskId: task.id,
        userId,
        kind: 'task',
        entityTitle: task.title,
      },
    });
  }

  return definitions;
}

function buildHabitReminderDefinitions(
  userId: string,
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
        body: '',
        timestamp,
        data: {
          screen: 'HabitDetail',
          habitId: habit.id,
          date: dateKey,
          userId,
          kind: 'habit',
          entityTitle: habit.title,
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
      Boolean(
        id && isScheduledReminderNotificationId(id) && !desiredIds.has(id),
      ),
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
  const reminderActions = getReminderAndroidActions();

  // Recreate the trigger so behavior/style changes are applied to existing IDs.
  await notifee.cancelNotification(definition.id).catch(() => undefined);

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
        actions: reminderActions,
        style: getReminderAndroidStyle(definition.title),
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.HIGH,
      },
      ios: {
        categoryId: REMINDER_ACTIONS_CATEGORY_ID,
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

  const taskDefinitions = buildTaskReminderDefinitions(
    payload.userId,
    payload.tasks,
    nowMs,
  );
  const habitDefinitions = buildHabitReminderDefinitions(
    payload.userId,
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
      actions: isReminderData(payload.data) ? getReminderAndroidActions() : [],
      style: isReminderData(payload.data)
        ? getReminderAndroidStyle(payload.title)
        : undefined,
      smallIcon: 'ic_launcher',
      importance:
        payload.channelId === TASK_REMINDER_CHANNEL_ID
          ? AndroidImportance.HIGH
          : AndroidImportance.DEFAULT,
    },
    ios: {
      categoryId: isReminderData(payload.data)
        ? REMINDER_ACTIONS_CATEGORY_ID
        : undefined,
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

function getResolvedReminderTitle(
  notification: Notification | undefined,
  data: NotificationData,
): string {
  const title = notification?.title?.trim();
  if (title) {
    return title;
  }
  return data.entityTitle ?? data.title ?? 'DoDo Reminder';
}

async function getNotificationUserId(
  data: NotificationData,
): Promise<string | null> {
  if (data.userId) {
    return data.userId;
  }

  try {
    const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as {id?: unknown};
    return typeof parsed?.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
}

async function getDefaultSnoozeMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_SNOOZE_MINUTES;
    }

    const parsed = JSON.parse(raw) as {defaultSnoozeMinutes?: unknown};
    if (
      typeof parsed.defaultSnoozeMinutes === 'number' &&
      Number.isFinite(parsed.defaultSnoozeMinutes)
    ) {
      return Math.max(
        1,
        Math.min(1440, Math.round(parsed.defaultSnoozeMinutes)),
      );
    }

    return DEFAULT_SNOOZE_MINUTES;
  } catch {
    return DEFAULT_SNOOZE_MINUTES;
  }
}

function getTaskSnoozeNotificationId(taskId: string): string {
  return `${TASK_SNOOZE_NOTIFICATION_PREFIX}${taskId}-${Date.now()}`;
}

function getHabitSnoozeNotificationId(habitId: string, date: string): string {
  return `${HABIT_SNOOZE_NOTIFICATION_PREFIX}${habitId}-${date}-${Date.now()}`;
}

async function completeReminderFromData(data: NotificationData): Promise<void> {
  const userId = await getNotificationUserId(data);
  if (!userId) {
    devWarn('Unable to complete reminder; missing user id', data);
    return;
  }

  if (data.taskId) {
    await updateTaskLocal(userId, data.taskId, {completed: true});
    await runSync(userId, 'manual');
    return;
  }

  if (data.habitId) {
    const targetDate = data.date ?? localDateKey(new Date());
    await setHabitCompletedLocal({
      userId,
      habitId: data.habitId,
      date: targetDate,
      completed: true,
    });
    await runSync(userId, 'manual');
  }
}

async function cancelReminderNotificationsForData(
  data: NotificationData,
  currentNotificationId?: string,
): Promise<void> {
  const ids = new Set<string>();

  if (currentNotificationId) {
    ids.add(currentNotificationId);
  }

  if (data.taskId) {
    ids.add(`${TASK_REMINDER_NOTIFICATION_PREFIX}${data.taskId}`);
  }

  if (data.habitId && data.date) {
    ids.add(
      `${HABIT_REMINDER_NOTIFICATION_PREFIX}${data.habitId}-${data.date}`,
    );
  }

  const existingTriggers = await notifee.getTriggerNotifications();
  for (const item of existingTriggers) {
    const id = item.notification.id;
    if (!id) {
      continue;
    }

    if (
      data.taskId &&
      id.startsWith(`${TASK_SNOOZE_NOTIFICATION_PREFIX}${data.taskId}-`)
    ) {
      ids.add(id);
    }

    if (
      data.habitId &&
      data.date &&
      id.startsWith(
        `${HABIT_SNOOZE_NOTIFICATION_PREFIX}${data.habitId}-${data.date}-`,
      )
    ) {
      ids.add(id);
    }
  }

  await Promise.all(
    Array.from(ids).map(id =>
      notifee.cancelNotification(id).catch(error => {
        devWarn('Unable to cancel reminder notification', error);
      }),
    ),
  );
}

async function handleReminderActionPress(
  actionId: string,
  data: NotificationData,
  notification: Notification | undefined,
  context: NotificationContext,
): Promise<void> {
  if (actionId === REMINDER_ACTION_LOCK_IN) {
    handlePressedNotificationData({...data, openFocus: '1'});
    return;
  }

  if (actionId === REMINDER_ACTION_COMPLETE) {
    await completeReminderFromData(data);
    await cancelReminderNotificationsForData(data, notification?.id);
    return;
  }

  if (actionId === REMINDER_ACTION_SNOOZE) {
    await cancelReminderNotificationsForData(data, notification?.id);
    const snoozeMinutes = await getDefaultSnoozeMinutes();
    await scheduleSnoozedReminder(
      data,
      getResolvedReminderTitle(notification, data),
      snoozeMinutes,
    );
    return;
  }

  handlePressedNotificationData(data);
}

async function handleNotifeeEventInternal(
  event: Event,
  context: NotificationContext,
): Promise<void> {
  if (event.type === EventType.ACTION_PRESS) {
    const data = event.detail.notification?.data as
      | NotificationData
      | undefined;

    if (!data) {
      return;
    }

    const actionId = event.detail.pressAction?.id ?? 'default';
    await handleReminderActionPress(
      actionId,
      data,
      event.detail.notification,
      context,
    );
    return;
  }

  if (event.type === EventType.PRESS) {
    const data = event.detail.notification?.data as
      | NotificationData
      | undefined;
    handlePressedNotificationData(data);
  }
}

export async function scheduleSnoozedReminder(
  data: NotificationData,
  title: string,
  minutes: number,
): Promise<void> {
  const safeMinutes = Math.max(1, Math.min(1440, Math.round(minutes)));
  const timestamp = Date.now() + safeMinutes * 60 * 1000;
  const resolvedTitle = title.trim() || data.entityTitle || 'DoDo Reminder';
  const reminderData: NotificationData = {
    ...data,
    snoozed: '1',
  };

  let id: string;
  if (reminderData.taskId) {
    id = getTaskSnoozeNotificationId(reminderData.taskId);
  } else if (reminderData.habitId) {
    const date = reminderData.date ?? localDateKey(new Date());
    reminderData.date = date;
    id = getHabitSnoozeNotificationId(reminderData.habitId, date);
  } else {
    id = `snooze-${Date.now()}`;
  }

  await scheduleReminderDefinition({
    id,
    title: resolvedTitle,
    body: '',
    timestamp,
    data: reminderData,
  });
}

function handleNotifeeEvent(event: Event): void {
  void handleNotifeeEventInternal(event, 'foreground').catch(error => {
    devWarn('Unable to handle notification event', error);
  });
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

  await notifee.setNotificationCategories([
    {
      id: REMINDER_ACTIONS_CATEGORY_ID,
      actions: [
        {
          id: REMINDER_ACTION_LOCK_IN,
          title: 'Lock in',
          foreground: true,
        },
        {
          id: REMINDER_ACTION_COMPLETE,
          title: 'Complete',
          foreground: false,
        },
        {
          id: REMINDER_ACTION_SNOOZE,
          title: 'Snooze',
          foreground: false,
        },
      ],
    },
  ]);

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
      const data = initialNotifeeNotification.notification
        .data as NotificationData;
      const actionId = initialNotifeeNotification.pressAction?.id ?? 'default';

      await handleReminderActionPress(
        actionId,
        data,
        initialNotifeeNotification.notification,
        'foreground',
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

export async function handleBackgroundNotificationEvent(
  event: Event,
): Promise<void> {
  try {
    await handleNotifeeEventInternal(event, 'background');
  } catch (error) {
    devWarn('Unable to handle background notification event', error);
  }
}
