import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {AppIcon} from '../../components/AppIcon';
import {FocusModeScreen} from '../../components/focus/FocusModeScreen';
import {HoldToConfirmButton} from '../../components/focus/HoldToConfirmButton';
import {HabitForm} from '../../components/forms/HabitForm';
import {LoadingScreen} from '../../components/feedback/LoadingScreen';
import {useHabits} from '../../state/HabitsContext';
import {usePreferences} from '../../state/PreferencesContext';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {fontSize, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {
  buildHabitTrackerDateKeys,
  formatHabitFrequency,
  habitAppliesToDate,
  minuteToLabel,
} from '../../utils/habits';
import {formatClockDuration} from '../../utils/taskTiming';

type HabitDetailRoute = RouteProp<RootStackParamList, 'HabitDetail'>;

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitDetailScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const route = useRoute<HabitDetailRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {preferences} = usePreferences();
  const {
    habits,
    loading,
    initialized,
    editHabit,
    removeHabit,
    loadHistory,
    isHabitCompletedOn,
    setHabitCompletedOn,
    startHabitTimer,
    pauseHabitTimer,
  } = useHabits();

  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());

  const habit = habits.find(h => h.id === route.params.habitId);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  const trackerDateKeys = useMemo(
    () => (habit ? buildHabitTrackerDateKeys(habit, todayKey, 49) : []),
    [habit, todayKey],
  );

  useEffect(() => {
    if (!habit) {
      return;
    }
    const historyStartDate = trackerDateKeys[0];
    if (!historyStartDate) {
      return;
    }

    void loadHistory({habitId: habit.id, startDate: historyStartDate, endDate: todayKey});
  }, [habit?.id, loadHistory, todayKey, trackerDateKeys]);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = setInterval(() => setLockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [lockInMode]);

  const completedToday = habit ? isHabitCompletedOn(habit.id, todayKey) : false;
  const canCompleteToday = habit ? habitAppliesToDate(habit, todayKey) : false;

  useEffect(() => {
    if (
      !lockInMode ||
      !habit ||
      !canCompleteToday ||
      completedToday ||
      habit.timerStartedAt
    ) {
      return;
    }

    void startHabitTimer(habit.id, todayKey).catch(() => {});
  }, [
    canCompleteToday,
    completedToday,
    habit,
    lockInMode,
    startHabitTimer,
    todayKey,
  ]);

  const focusElapsedSeconds = useMemo(() => {
    if (!habit) {
      return 0;
    }

    let total = Math.max(0, habit.trackedSecondsToday ?? 0);
    if (!habit.timerStartedAt) {
      return total;
    }

    const startedAtMs = Date.parse(habit.timerStartedAt);
    if (!Number.isFinite(startedAtMs)) {
      return total;
    }

    total += Math.max(0, Math.floor((lockTime.getTime() - startedAtMs) / 1000));
    return total;
  }, [habit, lockTime]);

  if (!initialized || (loading && habits.length === 0)) {
    return <LoadingScreen title="Loading habit" />;
  }

  if (!habit) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <AppIcon name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Habit</Text>
          <View style={styles.placeholderHeader} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Habit not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentHabit = habit;

  async function handleExitFocus() {
    try {
      if (
        currentHabit.timerStartedAt &&
        !completedToday &&
        canCompleteToday
      ) {
        await pauseHabitTimer(currentHabit.id, todayKey);
      }
      setLockInMode(false);
    } catch (err) {
      showAlert(
        'Failed to pause timer',
        err instanceof Error ? err.message : 'Unable to pause focus timer.',
      );
    }
  }

  if (lockInMode) {
    return (
      <FocusModeScreen
        now={lockTime}
        timeFormat={preferences.timeFormat}
        title={currentHabit.title}
        metaLines={[
          formatHabitFrequency(currentHabit),
          minuteToLabel(currentHabit.timeMinute, preferences.timeFormat),
        ]}
        infoIconName={currentHabit.icon}
        infoIconColor={colors.habitBadge}
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'}
        actionIconName={canCompleteToday ? (completedToday ? 'rotate-ccw' : 'check') : 'edit'}
        onActionPress={canCompleteToday ? toggleTodayCompletion : () => setEditVisible(true)}
        actionDisabled={busy && canCompleteToday}
        actionDone={canCompleteToday && completedToday}
      />
    );
  }

  async function toggleTodayCompletion() {
    setBusy(true);
    try {
      await setHabitCompletedOn(currentHabit.id, todayKey, !completedToday);
    } catch (err) {
      showAlert(
        'Failed',
        err instanceof Error ? err.message : 'Unable to update completion.',
      );
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    showAlert('Delete Habit', 'This will remove the habit and its history.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeHabit(currentHabit.id);
            navigation.goBack();
          } catch (err) {
            showAlert(
              'Failed',
              err instanceof Error ? err.message : 'Unable to delete habit.',
            );
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}>
          <AppIcon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrapRow}>
          <View style={styles.headerIconInline}>
            <AppIcon name={currentHabit.icon} size={28} color={colors.habitBadge} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {currentHabit.title}
          </Text>
        </View>
        {canCompleteToday ? (
          <Pressable onPress={() => setEditVisible(true)} hitSlop={12}>
            <AppIcon name="edit" size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.placeholderHeader} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bounces={false}>
        <View style={styles.quickInfoRow}>
          <View style={styles.infoPill}>
            <AppIcon name="flame" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>
             {currentHabit.currentStreak}   Current
            </Text>
          </View>
          <View style={styles.infoPill}>
            <AppIcon name="flame" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>{currentHabit.bestStreak}  Best</Text>
          </View>
        </View>

        <View style={styles.quickInfoRow}>
          <View style={styles.infoPill}>
            <AppIcon name="clock" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>
              {minuteToLabel(currentHabit.timeMinute, preferences.timeFormat)}
            </Text>
          </View>
          <View style={styles.infoPill}>
            <AppIcon name="hourglass" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>
              {currentHabit.durationMinutes
                ? `${currentHabit.durationMinutes}m`
                : formatClockDuration(focusElapsedSeconds)}
            </Text>
          </View>
        </View>

        <View style={styles.quickInfoRow}>
          <View style={styles.infoPillFull}>
            <AppIcon name="repeat" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>{formatHabitFrequency(currentHabit)}</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.dotGrid}>
            {trackerDateKeys.map(key => {
              const completed = isHabitCompletedOn(currentHabit.id, key);
              const isFuture = key > todayKey;
              const isToday = key === todayKey;
              return (
                <View key={key} style={styles.dotCell}>
                  <View
                    style={[
                      styles.dot,
                      completed && !isFuture && styles.dotDone,
                      isToday && styles.dotToday,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.floatingActions}>
        <HoldToConfirmButton
          iconName="lock"
          onHoldComplete={() => setLockInMode(true)}
          holdDurationMs={1500}
          size={84}
          style={styles.lockInFloatingBtn}
        />

        <View style={styles.primaryActionsRow}>
          <Pressable
            style={[
              styles.actionBtn,
              canCompleteToday
                ? completedToday
                  ? styles.actionBtnDone
                  : styles.completeBtn
                : styles.completeBtn,
              busy && styles.disabled,
            ]}
            disabled={busy && canCompleteToday}
            onPress={canCompleteToday ? toggleTodayCompletion : () => setEditVisible(true)}>
            <AppIcon
              name={canCompleteToday ? (completedToday ? 'rotate-ccw' : 'edit') : 'edit'}
              size={18}
              color={canCompleteToday && completedToday ? colors.accent : '#fff'}
            />
            <Text
              style={[
                styles.actionBtnText,
                {
                  color:
                    canCompleteToday && completedToday ? colors.accent : '#fff',
                },
              ]}>
              {canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={onDelete}>
            <AppIcon name="trash-2" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, {color: '#fff'}]}>Delete</Text>
          </Pressable>
        </View>
      </View>

      <HabitForm
        visible={editVisible}
        mode="edit"
        initialValues={currentHabit}
        onCancel={() => setEditVisible(false)}
        onSubmit={payload => editHabit(currentHabit.id, payload)}
      />
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
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      minHeight: 100,
    },
    headerTitleWrapRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.sm,
      minWidth: 0,
      gap: spacing.sm,
    },
    headerIconInline: {
      width: 28,
      height: 28,
      padding: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.heading,
    },
    placeholderHeader: {
      width: 24,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: 190,
      paddingTop: spacing.xs,
      gap: spacing.md,
    },
    name: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontFamily: fonts.heading,
      textAlign: 'left',
      lineHeight: 48,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    quickInfoRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    infoPill: {
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
    infoPillFull: {
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
    infoPillText: {
      color: colors.mutedText,
      fontSize: fontSize.xs,
      fontFamily: fonts.bodyBold,
    },
    progressCard: {
      marginTop: spacing.md,
      borderRadius: 20,
      padding: spacing.md,
    },
    dotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 22,
      columnGap: 0,
    },
    dotCell: {
      width: '14.28%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceLight,
    },
    dotDone: {
      backgroundColor: colors.habitBadge,
    },
    dotToday: {
      borderWidth: 3,
      borderColor: colors.text,
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
    actionBtnDone: {
      backgroundColor: colors.surface,
    },
    deleteBtn: {
      backgroundColor: colors.danger,
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
    lockInFloatingBtn: {
      marginBottom: 8,
      alignSelf: 'center',
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: fontSize.md,
      fontFamily: fonts.body,
    },
    disabled: {
      opacity: 0.5,
    },
    actionBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
      color: '#fff',
    },
  });
