import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTasks} from '../../state/TasksContext';
import {useCategories} from '../../state/CategoriesContext';
import {usePreferences} from '../../state/PreferencesContext';
import {AppIcon, type AppIconName} from '../../components/AppIcon';
import {FocusModeScreen} from '../../components/focus/FocusModeScreen';
import {HoldToConfirmButton} from '../../components/focus/HoldToConfirmButton';
import {LoadingScreen} from '../../components/feedback/LoadingScreen';
import {CustomDatePicker} from '../../components/forms/pickers/CustomDatePicker';
import {CustomTimePicker} from '../../components/forms/pickers/CustomTimePicker';
import {CustomDurationPicker} from '../../components/forms/pickers/CustomDurationPicker';
import {spacing, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {
  type ThemeColors,
  useThemeColors,
  useThemeMode,
} from '../../theme/ThemeProvider';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import type {CreateTaskInput, Priority, Task} from '../../types/task';
import {formatDate, formatDateTime, formatTime} from '../../utils/dateTime';
import {getTaskTrackedSeconds} from '../../utils/taskTiming';

function priorityMeta(
  priority: Priority,
  colors: ThemeColors,
): {
  label: string;
  color: string;
  icon: 'arrow-down-circle' | 'minus-circle' | 'arrow-up-circle';
} {
  if (priority === 3) {
    return {label: 'High', color: colors.highPriority, icon: 'arrow-up-circle'};
  }
  if (priority === 2) {
    return {
      label: 'Medium',
      color: colors.mediumPriority,
      icon: 'minus-circle',
    };
  }
  return {label: 'Low', color: colors.lowPriority, icon: 'arrow-down-circle'};
}

function getTaskDurationMinutes(task: Task): number {
  if (task.durationMinutes != null && Number.isFinite(task.durationMinutes)) {
    return Math.max(1, task.durationMinutes);
  }
  const inferred = Math.round(
    (new Date(task.deadline).getTime() - new Date(task.scheduledAt).getTime()) /
      60000,
  );
  return Math.max(1, inferred || 60);
}

function formatDurationSmart(mins: number): string {
  if (mins < 60) {
    return `${mins}m`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h${m}m`;
}

export function TaskDetailScreen() {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    tasks,
    loading: tasksLoading,
    initialized: tasksInitialized,
    startTimer,
    pauseTimer,
    toggleTaskCompletion,
    removeTask,
    updateTaskDetails,
  } = useTasks();
  const {
    categories,
    loading: categoriesLoading,
    initialized: categoriesInitialized,
  } = useCategories();
  const {preferences} = usePreferences();

  const taskId = route.params.taskId;
  const openFocusFromNotification = route.params.openFocus === true;
  const task = tasks.find(t => t.id === taskId);

  const [activeTab, setActiveTab] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<Priority>(2);
  const [scheduledAtDraft, setScheduledAtDraft] = useState(() => new Date());
  const [durationMinutesDraft, setDurationMinutesDraft] = useState(60);
  const [categoryIdDraft, setCategoryIdDraft] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavedSignatureRef = useRef('');
  const autoSaveErrorShownRef = useRef(false);

  useEffect(() => {
    if (!task) {
      return;
    }
    setTitleDraft(task.title);
    setPriorityDraft(task.priority);
    setScheduledAtDraft(new Date(task.scheduledAt));
    setDurationMinutesDraft(getTaskDurationMinutes(task));
    setCategoryIdDraft(task.categoryId);
    setActiveTab('');
    lastAutoSavedSignatureRef.current = '';
    autoSaveErrorShownRef.current = false;
  }, [task]);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = setInterval(() => setLockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [lockInMode]);

  useEffect(() => {
    if (!lockInMode || !task || task.completed || task.timerStartedAt) {
      return;
    }

    void startTimer(task).catch(() => {});
  }, [lockInMode, startTimer, task]);

  useEffect(() => {
    if (!task || !openFocusFromNotification || lockInMode) {
      return;
    }

    setLockInMode(true);
    navigation.setParams({openFocus: undefined});
  }, [lockInMode, navigation, openFocusFromNotification, task]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const category = task?.categoryId
    ? categories.find(c => c.id === task.categoryId) ?? null
    : null;
  const categoryName = category?.name ?? 'None';
  const selectedCategory = categoryIdDraft
    ? categories.find(c => c.id === categoryIdDraft) ?? null
    : null;

  const priorityInfo = useMemo(
    () => (task ? priorityMeta(task.priority, colors) : null),
    [task, colors],
  );
  const focusElapsedSeconds = useMemo(
    () => (task ? getTaskTrackedSeconds(task, lockTime) : 0),
    [lockTime, task],
  );

  const draftPriorityInfo = useMemo(
    () => priorityMeta(priorityDraft, colors),
    [priorityDraft, colors],
  );

  const durationLabel = formatDurationSmart(durationMinutesDraft);
  const tabsTop = [
    {
      id: 'date',
      icon: 'calendar' as AppIconName,
      valueDisplay: formatDate(scheduledAtDraft, preferences.dateFormat),
    },
    {
      id: 'time',
      icon: 'clock' as AppIconName,
      valueDisplay: formatTime(scheduledAtDraft, preferences.timeFormat),
    },
  ];

  const tabsBottom = [
    {
      id: 'priority',
      icon: draftPriorityInfo.icon,
      color: draftPriorityInfo.color,
      valueDisplay:
        priorityDraft === 3 ? 'High' : priorityDraft === 2 ? 'Med' : 'Low',
    },
    {
      id: 'duration',
      icon: 'hourglass' as AppIconName,
      valueDisplay: durationLabel,
    },
    ...(categories.length > 0
      ? [
          {
            id: 'category',
            icon: (selectedCategory?.icon ?? 'package') as AppIconName,
            color: selectedCategory?.color,
            valueDisplay: selectedCategory?.name ?? 'Category',
          },
        ]
      : []),
  ];

  const hasChanges = useMemo(() => {
    if (!task) {
      return false;
    }
    const originalDuration = getTaskDurationMinutes(task);
    return (
      titleDraft.trim() !== task.title ||
      priorityDraft !== task.priority ||
      categoryIdDraft !== task.categoryId ||
      durationMinutesDraft !== originalDuration ||
      scheduledAtDraft.toISOString() !==
        new Date(task.scheduledAt).toISOString()
    );
  }, [
    task,
    titleDraft,
    priorityDraft,
    categoryIdDraft,
    durationMinutesDraft,
    scheduledAtDraft,
  ]);

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function scheduleDelete(taskId: string) {
    clearUndoTimer();
    setPendingDelete(true);
    undoTimerRef.current = setTimeout(() => {
      void removeTask(taskId).finally(() => navigation.goBack());
      setPendingDelete(false);
      undoTimerRef.current = null;
    }, 3000);
  }

  async function handleComplete() {
    if (!task || busy || pendingDelete || savingDetails) {
      return;
    }

    if (task.completed) {
      setBusy(true);
      try {
        await toggleTaskCompletion(task);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await toggleTaskCompletion(task);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    if (!task || busy || savingDetails || pendingDelete) {
      return;
    }

    showAlert('Delete task?', 'This action cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => scheduleDelete(task.id),
      },
    ]);
  }

  async function handleExitFocus() {
    if (!task) {
      setLockInMode(false);
      return;
    }

    setLockInMode(false);

    try {
      if (!task.completed && task.timerStartedAt) {
        await pauseTimer(task);
      }
    } catch (err) {
      showAlert(
        'Failed to pause timer',
        err instanceof Error ? err.message : 'Unable to pause focus timer.',
      );
    }
  }

  useEffect(() => {
    if (!task || busy || pendingDelete || savingDetails) {
      return;
    }

    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      return;
    }
    if (!Number.isFinite(durationMinutesDraft) || durationMinutesDraft < 1) {
      return;
    }
    if (!hasChanges) {
      return;
    }

    const signature = [
      trimmedTitle,
      priorityDraft,
      categoryIdDraft ?? 'none',
      durationMinutesDraft,
      scheduledAtDraft.toISOString(),
    ].join('|');

    if (signature === lastAutoSavedSignatureRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const deadline = new Date(
        scheduledAtDraft.getTime() + durationMinutesDraft * 60 * 1000,
      );

      const input: CreateTaskInput = {
        title: trimmedTitle,
        description: task.description ?? '',
        categoryId: categoryIdDraft,
        scheduledAt: scheduledAtDraft.toISOString(),
        deadline: deadline.toISOString(),
        durationMinutes: durationMinutesDraft,
        priority: priorityDraft,
      };

      setSavingDetails(true);
      void updateTaskDetails(task.id, input)
        .then(() => {
          lastAutoSavedSignatureRef.current = signature;
          autoSaveErrorShownRef.current = false;
        })
        .catch(err => {
          if (!autoSaveErrorShownRef.current) {
            showAlert(
              'Failed to update task',
              err instanceof Error ? err.message : 'Unknown error',
            );
            autoSaveErrorShownRef.current = true;
          }
        })
        .finally(() => {
          setSavingDetails(false);
        });
    }, 450);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    task,
    hasChanges,
    titleDraft,
    priorityDraft,
    categoryIdDraft,
    durationMinutesDraft,
    scheduledAtDraft,
    busy,
    pendingDelete,
    savingDetails,
    updateTaskDetails,
    showAlert,
  ]);

  if (
    !tasksInitialized ||
    !categoriesInitialized ||
    (tasksLoading && tasks.length === 0) ||
    (categoriesLoading && categories.length === 0)
  ) {
    return <LoadingScreen title="Loading task" />;
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <AppIcon name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Task</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (lockInMode) {
    return (
      <FocusModeScreen
        now={lockTime}
        timeFormat={preferences.timeFormat}
        title={task.title}
        metaLines={[
          `${categoryName} · ${priorityInfo?.label ?? 'Priority'}`,
          `Due ${formatDateTime(task.deadline, {
            dateFormat: preferences.dateFormat,
            timeFormat: preferences.timeFormat,
            weekStart: preferences.weekStart,
          })}`,
        ]}
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={task.completed ? 'Undo' : 'Complete'}
        actionIconName={task.completed ? 'rotate-ccw' : 'check'}
        onActionPress={handleComplete}
        actionDisabled={busy || savingDetails}
        actionDone={task.completed}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <AppIcon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleInputWrap}>
          <TextInput
            value={titleDraft}
            style={styles.headerTitle}
            onChangeText={setTitleDraft}
          />
        </View>
        <View style={{width: 24}} />
      </View>

      <View style={{flex: 1}}>
        {!pendingDelete ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}>
            <View style={styles.tabsWrapper}>
              <View style={styles.tabsRow}>
                {tabsTop.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                      onPress={() => setActiveTab(isActive ? '' : tab.id)}>
                      <AppIcon
                        name={tab.icon}
                        size={16}
                        color={isActive ? '#fff' : colors.mutedText}
                      />
                      <Text
                        style={[
                          styles.tabValue,
                          isActive && styles.tabValueLight,
                        ]}
                        numberOfLines={1}>
                        {tab.valueDisplay}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.tabsRow}>
                {tabsBottom.map(tab => {
                  const isActive = activeTab === tab.id;
                  const hasColor = !!tab.color;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[
                        styles.tabBtn,
                        isActive
                          ? styles.tabBtnActive
                          : hasColor
                          ? {backgroundColor: tab.color}
                          : undefined,
                      ]}
                      onPress={() => setActiveTab(isActive ? '' : tab.id)}>
                      <AppIcon
                        name={tab.icon}
                        size={16}
                        color={isActive || hasColor ? '#fff' : colors.mutedText}
                      />
                      <Text
                        style={[
                          styles.tabValue,
                          (isActive || hasColor) && styles.tabValueLight,
                        ]}
                        numberOfLines={1}>
                        {tab.valueDisplay}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {activeTab === 'priority' && (
              <View style={styles.sectionCard}>
                <Text style={styles.contentLabel}>Priority Level</Text>
                <View style={styles.wrapRow}>
                  {([1, 2, 3] as Priority[]).map(p => {
                    const active = priorityDraft === p;
                    const col =
                      p === 3
                        ? colors.highPriority
                        : p === 2
                        ? colors.mediumPriority
                        : colors.lowPriority;
                    return (
                      <Pressable
                        key={p}
                        style={[
                          styles.chipBtn,
                          active && {backgroundColor: col},
                        ]}
                        onPress={() => setPriorityDraft(p)}>
                        <AppIcon
                          name={
                            p === 3
                              ? 'arrow-up-circle'
                              : p === 2
                              ? 'minus-circle'
                              : 'arrow-down-circle'
                          }
                          size={18}
                          color={active ? '#fff' : colors.mutedText}
                        />
                        <Text
                          style={[
                            styles.chipBtnText,
                            active && {color: '#fff'},
                          ]}>
                          {p === 1 ? 'Low' : p === 2 ? 'Medium' : 'High'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {activeTab === 'date' && (
              <View style={styles.sectionCard}>
                <View style={styles.compactDateWrap}>
                  <CustomDatePicker
                    key={`task-detail-picker-date-${themeMode}`}
                    value={scheduledAtDraft}
                    onChange={setScheduledAtDraft}
                    weekStart={preferences.weekStart}
                  />
                </View>
              </View>
            )}

            {activeTab === 'time' && (
              <View style={styles.sectionCard}>
                <CustomTimePicker
                  key={`task-detail-picker-time-${themeMode}`}
                  value={scheduledAtDraft}
                  onChange={setScheduledAtDraft}
                  timeFormat={preferences.timeFormat}
                />
              </View>
            )}

            {activeTab === 'duration' && (
              <View style={styles.sectionCard}>
                <CustomDurationPicker
                  value={durationMinutesDraft}
                  onChange={setDurationMinutesDraft}
                />
              </View>
            )}

            {activeTab === 'category' && (
              <View style={styles.sectionCard}>
                <Text style={styles.contentLabel}>Select Category</Text>
                <View style={styles.wrapRow}>
                  {categories.map(cat => {
                    const active = categoryIdDraft === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.catChip,
                          active && {backgroundColor: cat.color},
                        ]}
                        onPress={() =>
                          setCategoryIdDraft(active ? null : cat.id)
                        }>
                        <AppIcon
                          name={cat.icon as AppIconName}
                          size={16}
                          color={active ? '#fff' : colors.mutedText}
                        />
                        <Text
                          style={[
                            styles.catChipText,
                            active && {
                              color: '#fff',
                              fontFamily: fonts.bodyBold,
                            },
                          ]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.deletedState}>
            <AppIcon name="trash-2" size={24} color={colors.danger} />
            <Text style={styles.deletedTitle}>Task deleted</Text>
            <Text style={styles.deletedText}>Removing task...</Text>
          </View>
        )}
      </View>

      <View style={styles.floatingActions}>
        <HoldToConfirmButton
          iconName="lock"
          onHoldComplete={() => setLockInMode(true)}
          holdDurationMs={1500}
          size={84}
          style={styles.lockInBtn}
        />

        <View style={styles.primaryActionsRow}>
          <Pressable
            style={[
              styles.actionBtn,
              task.completed
                ? {backgroundColor: colors.surface}
                : styles.completeBtn,
            ]}
            onPress={handleComplete}
            disabled={busy || savingDetails}>
            <AppIcon
              name={task.completed ? 'rotate-ccw' : 'check'}
              size={18}
              color={task.completed ? colors.accent : '#fff'}
            />
            <Text
              style={[
                styles.actionBtnText,
                {color: task.completed ? colors.accent : '#fff'},
              ]}>
              {task.completed ? 'Undo' : 'Complete'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={handleDelete}
            disabled={busy || savingDetails}>
            <AppIcon name="trash-2" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, {color: '#fff'}]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSize.xxl,
      fontFamily: fonts.headingSemiBold,
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
      marginBottom: 0,
    },
    headerTitleInputWrap: {
      flex: 1,
      minWidth: 0,
      marginHorizontal: spacing.sm,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: 190,
      paddingTop: spacing.xs,
      gap: spacing.md,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
    },
    deletedState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    deletedTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontFamily: fonts.headingSemiBold,
      letterSpacing: -0.3,
    },
    deletedText: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
      textAlign: 'center',
    },
    tabsWrapper: {
      gap: 16,
      marginBottom: 10,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    tabBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surfaceLight,
    },
    tabBtnActive: {
      backgroundColor: colors.accent,
    },
    tabValue: {
      fontSize: fontSize.xs,
      color: colors.mutedText,
      fontFamily: fonts.bodyBold,
    },
    tabValueLight: {
      color: '#fff',
    },
    sectionCard: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      padding: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    compactDateWrap: {
      alignSelf: 'center',
      width: '100%',
      transform: [{scale: 0.9}],
      marginVertical: -14,
    },
    contentLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chipBtn: {
      flex: 1,
      minWidth: '30%',
      borderRadius: 50,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.surfaceLight,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    chipBtnText: {
      fontFamily: fonts.bodyBold,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    catChip: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      gap: 8,
    },
    catChipText: {
      fontFamily: fonts.bodyBold,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    floatingActions: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      bottom: 20,
      gap: spacing.lg,
    },
    primaryActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    lockInBtn: {
      marginBottom: 8,
      alignSelf: 'center',
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 56,
      paddingVertical: spacing.sm,
      borderRadius: 999,
    },
    completeBtn: {
      backgroundColor: colors.accent,
    },
    deleteBtn: {
      backgroundColor: colors.danger,
    },
    actionBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
      color: '#fff',
    },
  });
