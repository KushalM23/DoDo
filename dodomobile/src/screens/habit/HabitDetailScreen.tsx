import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {AppIcon} from '../../components/AppIcon';
import {HoldToConfirmButton} from '../../components/HoldToConfirmButton';
import {HabitForm} from '../../components/HabitForm';
import {LoadingScreen} from '../../components/LoadingScreen';
import {useHabits} from '../../state/HabitsContext';
import {usePreferences} from '../../state/PreferencesContext';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {fontSize, radii, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {
  formatHabitFrequency,
  habitAppliesToDate,
  minuteToLabel,
} from '../../utils/habits';

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
  } = useHabits();

  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoProgress, setUndoProgress] = useState(0);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const habit = habits.find(h => h.id === route.params.habitId);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  const trackerDates = useMemo(() => {
    if (!habit) {
      return [] as Date[];
    }

    const startKey = habit.anchorDate ?? habit.createdAt.slice(0, 10);
    const startDate = new Date(`${startKey}T00:00:00`);
    const recentStart = new Date(today);
    recentStart.setDate(today.getDate() - 48);

    const cursor = startDate > recentStart ? new Date(startDate) : recentStart;
    const out: Date[] = [];
    let guard = 0;

    while (out.length < 49 && guard < 1200) {
      const key = dateKey(cursor);
      if (habitAppliesToDate(habit, key)) {
        out.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }

    return out;
  }, [habit, today]);

  useEffect(() => {
    if (!habit) {
      return;
    }
    const historyStartDate = trackerDates[0];
    if (!historyStartDate) {
      return;
    }

    const start = dateKey(historyStartDate);
    const end = todayKey;
    void loadHistory({habitId: habit.id, startDate: start, endDate: end});
  }, [habit?.id, loadHistory, todayKey, trackerDates]);

  const undoActionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      clearUndoTimers();
    };
  }, []);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = setInterval(() => setLockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [lockInMode]);

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

  const completedToday = isHabitCompletedOn(currentHabit.id, todayKey);
  const canCompleteToday = habitAppliesToDate(currentHabit, todayKey);
  if (lockInMode) {
    const hour24 = lockTime.getHours();
    const lockHour = String(
      preferences.timeFormat === '24h' ? hour24 : ((hour24 + 11) % 12) + 1,
    ).padStart(2, '0');
    const lockMinute = String(lockTime.getMinutes()).padStart(2, '0');

    return (
      <SafeAreaView style={styles.lockContainer} edges={['top', 'bottom']}>
        <View style={styles.lockContent}>
          <View style={styles.lockClockWrap}>
            <Text style={styles.lockClockLine}>{lockHour}</Text>
            <Text style={styles.lockClockLine}>{lockMinute}</Text>
          </View>

          <View style={styles.lockInfoBlock}>
            <View style={styles.lockIconPill}>
              <AppIcon
                name={currentHabit.icon}
                size={18}
                color={colors.habitBadge}
              />
            </View>
            <Text style={styles.lockTitle}>{currentHabit.title}</Text>
            <Text style={styles.lockMeta}>
              {formatHabitFrequency(currentHabit)}
            </Text>
            <Text style={styles.lockMeta}>
              {minuteToLabel(currentHabit.timeMinute, preferences.timeFormat)}
            </Text>
          </View>

          <HoldToConfirmButton
            iconName="lock-open"
            onHoldComplete={() => setLockInMode(false)}
            holdDurationMs={3000}
            square
            size={80}
            progressStyle="fill"
            showHint={false}
            style={styles.lockExitBtn}
            fillColor={colors.danger}
          />

          <View style={styles.lockActionsRow}>
            <Pressable
              style={[
                styles.lockActionBtn,
                canCompleteToday && completedToday
                  ? styles.lockActionBtnDone
                  : styles.lockActionBtnPrimary,
                busy && styles.disabled,
              ]}
              disabled={busy && canCompleteToday}
              onPress={
                canCompleteToday
                  ? toggleTodayCompletion
                  : () => setEditVisible(true)
              }>
              <AppIcon
                name={canCompleteToday ? (completedToday ? 'rotate-ccw' : 'check') : 'edit'}
                size={16}
                color={canCompleteToday && completedToday ? colors.accent : '#fff'}
              />
              <Text
                style={[
                  styles.lockActionText,
                  {
                    color:
                      canCompleteToday && completedToday ? colors.accent : '#fff',
                  },
                ]}>
                {canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function clearUndoTimers() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoProgressTimerRef.current) {
      clearInterval(undoProgressTimerRef.current);
      undoProgressTimerRef.current = null;
    }
  }

  function showUndoPopup(habitId: string, date: string) {
    clearUndoTimers();
    setUndoVisible(true);
    setUndoProgress(1);

    const startedAt = Date.now();
    undoProgressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 1 - elapsed / 3000);
      setUndoProgress(remaining);
      if (remaining <= 0 && undoProgressTimerRef.current) {
        clearInterval(undoProgressTimerRef.current);
        undoProgressTimerRef.current = null;
      }
    }, 50);

    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false);
      setUndoProgress(0);
      undoTimerRef.current = null;
    }, 3000);

    const undo = async () => {
      clearUndoTimers();
      setUndoVisible(false);
      setUndoProgress(0);
      try {
        await setHabitCompletedOn(habitId, date, false);
      } catch (err) {
        showAlert(
          'Failed to undo habit',
          err instanceof Error ? err.message : 'Unknown error',
        );
      }
    };

    return undo;
  }

  async function toggleTodayCompletion() {
    setBusy(true);
    try {
      const nextCompleted = !completedToday;
      await setHabitCompletedOn(currentHabit.id, todayKey, nextCompleted);
      if (nextCompleted) {
        undoActionRef.current = showUndoPopup(currentHabit.id, todayKey);
      } else {
        clearUndoTimers();
        setUndoVisible(false);
        setUndoProgress(0);
      }
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
                : 'No duration'}
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
          <View style={styles.progressHeaderRow}>
          </View>
          <View style={styles.dotGrid}>
            {trackerDates.map(day => {
              const key = dateKey(day);
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
          square
          size={80}
          progressStyle="fill"
          showHint={false}
          style={styles.lockInFloatingBtn}
          fillColor={colors.accent}
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
    lockContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    lockContent: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'stretch',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: 40,
      gap: spacing.sm,
    },
    lockClockWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
      paddingVertical: spacing.md,
    },
    lockClockLine: {
      color: colors.text,
      fontSize: 120,
      fontFamily: fonts.heading,
      lineHeight: 150,
      letterSpacing: -2,
      includeFontPadding: false,
    },
    lockInfoBlock: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    lockIconPill: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.habitBadge,
      backgroundColor: colors.habitBadgeLight,
      marginBottom: spacing.xs,
    },
    lockTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.headingSemiBold,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    lockMeta: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      fontFamily: fonts.body,
      textAlign: 'center',
    },
    lockActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      width: '100%',
    },
    lockActionBtn: {
      flex: 1,
      borderRadius: 999,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    lockActionBtnPrimary: {
      backgroundColor: colors.accent,
    },
    lockActionBtnDone: {
      backgroundColor: colors.surface,
    },
    lockActionText: {
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
    },
    lockExitBtn: {
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
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
    headerTitleWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.sm,
      minWidth: 0,
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
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontFamily: fonts.bodyBold,
      marginTop: spacing.xs,
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
      borderRadius: 20,
      padding: spacing.md,
      gap: spacing.md,
    },
    progressHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressCount: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
    },
    dotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 16,
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
      backgroundColor: colors.accent,
    },
    dotToday: {
      borderColor: colors.accent,
      borderWidth: 1,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    legendText: {
      color: colors.mutedText,
      fontSize: fontSize.xs,
      fontFamily: fonts.body,
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
      bottom: 40,
      gap: spacing.lg,
    },
    primaryActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    lockInFloatingBtn: {
      marginBottom: 56,
      alignSelf: 'center',
    },
    actionText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
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
    undoBar: {
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 6,
    },
    undoProgressTrack: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 4,
      backgroundColor: colors.border,
    },
    undoProgressFill: {
      height: '100%',
      backgroundColor: colors.accent,
    },
    undoText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodySemiBold,
    },
    undoAction: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
    },
    actionBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
      color: '#fff',
    },
  });
