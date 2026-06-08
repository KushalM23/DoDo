import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View, TextInput, Animated} from 'react-native';
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
import {CustomModal} from '../../components/overlays/CustomModal';
import {CustomDatePicker} from '../../components/forms/pickers/CustomDatePicker';

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
  const [pauseVisible, setPauseVisible] = useState(false);
  const [pauseTab, setPauseTab] = useState<'days' | 'date' | 'indefinite'>('days');
  const [pauseDaysText, setPauseDaysText] = useState('7');
  const [pauseDate, setPauseDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });

  const leftEdge = useRef(new Animated.Value(4)).current;
  const rightEdge = useRef(new Animated.Value(4)).current;
  const tabLayouts = useRef<Record<string, {x: number; width: number}>>({});
  const currentTabRef = useRef<'days' | 'date' | 'indefinite'>('days');

  const slidePillTo = (tab: 'days' | 'date' | 'indefinite') => {
    const m = tabLayouts.current[tab];
    if (!m) {
      return;
    }
    const targetLeft = m.x;
    const targetRight = m.x + m.width;

    const isMovingRight =
      (tab === 'date' && currentTabRef.current === 'days') ||
      (tab === 'indefinite' && currentTabRef.current !== 'indefinite');
    currentTabRef.current = tab;

    const fastSpring = {tension: 90, friction: 10, useNativeDriver: false};
    const slowSpring = {tension: 40, friction: 12, useNativeDriver: false};

    Animated.parallel([
      Animated.spring(leftEdge, {
        toValue: targetLeft,
        ...(isMovingRight ? slowSpring : fastSpring),
      }),
      Animated.spring(rightEdge, {
        toValue: targetRight,
        ...(isMovingRight ? fastSpring : slowSpring),
      }),
    ]).start();
  };

  const onTabLayout = (tab: 'days' | 'date' | 'indefinite', x: number, width: number) => {
    tabLayouts.current[tab] = {x, width};
    if (tab === pauseTab) {
      slidePillTo(tab);
    }
  };
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const openFocusFromNotification = route.params.openFocus === true;

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

    void loadHistory({
      habitId: habit.id,
      startDate: historyStartDate,
      endDate: todayKey,
    });
  }, [habit, loadHistory, todayKey, trackerDateKeys]);

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
    habit,
    canCompleteToday,
    completedToday,
    lockInMode,
    startHabitTimer,
    todayKey,
  ]);

  useEffect(() => {
    if (!habit || !openFocusFromNotification || lockInMode) {
      return;
    }

    setLockInMode(true);
    navigation.setParams({openFocus: undefined});
  }, [habit, lockInMode, navigation, openFocusFromNotification]);

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
    setLockInMode(false);

    try {
      if (currentHabit.timerStartedAt && !completedToday && canCompleteToday) {
        await pauseHabitTimer(currentHabit.id, todayKey);
      }
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
        actionLabel={
          canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'
        }
        actionIconName={
          canCompleteToday ? (completedToday ? 'rotate-ccw' : 'check') : 'edit'
        }
        onActionPress={
          canCompleteToday ? toggleTodayCompletion : () => setEditVisible(true)
        }
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

  async function handleConfirmPause() {
    setBusy(true);
    try {
      let pausedUntil: string | null = null;
      if (pauseTab === 'days') {
        const parsed = parseInt(pauseDaysText, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 365) {
          throw new Error('Pause duration must be between 1 and 365 days.');
        }
        const target = new Date();
        target.setDate(target.getDate() + parsed);
        pausedUntil = dateKey(target);
      } else if (pauseTab === 'date') {
        pausedUntil = dateKey(pauseDate);
      }
      await editHabit(currentHabit.id, {
        isPaused: true,
        pausedUntil,
      });
      setPauseVisible(false);
    } catch (err) {
      showAlert(
        'Failed to pause habit',
        err instanceof Error ? err.message : 'Unable to pause habit.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    showAlert('Resume Habit', 'Are you sure you want to resume this habit?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Resume',
        onPress: async () => {
          setBusy(true);
          try {
            await editHabit(currentHabit.id, {
              isPaused: false,
              pausedUntil: null,
            });
          } catch (err) {
            showAlert(
              'Failed to resume habit',
              err instanceof Error ? err.message : 'Unable to resume habit.',
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <AppIcon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrapRow}>
          <View style={styles.headerIconInline}>
            <AppIcon
              name={currentHabit.icon}
              size={28}
              color={colors.habitBadge}
            />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {currentHabit.title}
          </Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 16}}>
          <Pressable
            onPress={currentHabit.isPaused ? handleResume : () => setPauseVisible(true)}
            hitSlop={12}
            disabled={busy}>
            <AppIcon
              name={currentHabit.isPaused ? 'play' : 'pause'}
              size={20}
              color={colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => setEditVisible(true)}
            hitSlop={12}
            disabled={currentHabit.isPaused || busy}>
            <AppIcon
              name="edit"
              size={20}
              color={currentHabit.isPaused ? colors.mutedText : colors.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bounces={false}>
        <View style={styles.quickInfoRow}>
          <View style={styles.infoPill}>
            <AppIcon name="flame" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>
              {currentHabit.currentStreak} Current
            </Text>
          </View>
          <View style={styles.infoPill}>
            <AppIcon name="flame" size={14} color={colors.mutedText} />
            <Text style={styles.infoPillText}>
              {currentHabit.bestStreak} Best
            </Text>
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
            <Text style={styles.infoPillText}>
              {formatHabitFrequency(currentHabit)}
            </Text>
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
          disabled={currentHabit.isPaused}
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
              (busy || currentHabit.isPaused) && styles.disabled,
            ]}
            disabled={currentHabit.isPaused || (busy && canCompleteToday)}
            onPress={
              canCompleteToday
                ? toggleTodayCompletion
                : () => setEditVisible(true)
            }>
            <AppIcon
              name={
                canCompleteToday
                  ? completedToday
                    ? 'rotate-ccw'
                    : 'check'
                  : 'edit'
              }
              size={18}
              color={
                canCompleteToday && completedToday ? colors.accent : '#fff'
              }
            />
            <Text
              style={[
                styles.actionBtnText,
                {
                  color:
                    canCompleteToday && completedToday ? colors.accent : '#fff',
                },
              ]}>
              {canCompleteToday
                ? completedToday
                  ? 'Undo'
                  : 'Complete'
                : 'Edit'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.deleteBtn, currentHabit.isPaused && styles.disabled]}
            disabled={currentHabit.isPaused}
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

      <CustomModal
        visible={pauseVisible}
        title="Pause Habit"
        onClose={() => setPauseVisible(false)}>
        <View style={{flexDirection: 'row', backgroundColor: colors.surfaceLight, padding: 4, borderRadius: 24, position: 'relative', overflow: 'hidden', marginBottom: 16}}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: leftEdge,
              width: Animated.subtract(rightEdge, leftEdge),
              backgroundColor: colors.accent,
              borderRadius: 24,
            }}
          />
          {(['days', 'date', 'indefinite'] as const).map(tab => {
            const active = pauseTab === tab;
            const label = tab === 'days' ? 'For' : tab === 'date' ? 'Till' : 'Indefinite';
            return (
              <Pressable
                key={tab}
                onLayout={e => {
                  const {x, width} = e.nativeEvent.layout;
                  onTabLayout(tab, x, width);
                }}
                onPress={() => {
                  setPauseTab(tab);
                  slidePillTo(tab);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}>
                <Text
                  style={{
                    color: active ? '#fff' : colors.mutedText,
                    fontFamily: fonts.bodyBold,
                    fontSize: 16,
                  }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {pauseTab === 'days' && (() => {
          const parsed = parseInt(pauseDaysText, 10);
          const hasError = !isNaN(parsed) && parsed > 365;
          return (
            <View style={{alignItems: 'center', marginVertical: 4, position: 'relative'}}>
              <Text style={{color: colors.mutedText, fontFamily: fonts.bodyMedium, fontSize: 14, marginBottom: 8}}>
                Pause duration
              </Text>
              <View style={{position: 'relative', alignItems: 'center', width: '100%'}}>
                <TextInput
                  keyboardType="number-pad"
                  value={pauseDaysText}
                  onChangeText={setPauseDaysText}
                  style={{
                    width: 100,
                    textAlign: 'center',
                    borderRadius: 12,
                    backgroundColor: colors.surfaceLight,
                    borderColor: hasError ? colors.danger : colors.surfaceLight,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 24,
                    fontFamily: fonts.heading,
                    color: colors.text,
                  }}
                />
                <Text style={{fontSize: 16, marginTop:6, color: colors.mutedText, fontFamily: fonts.body}}>
                  days
                </Text>
                {hasError && (
                  <View style={styles.errorTooltip}>
                    <View style={styles.tooltipArrow} />
                    <AppIcon name="alert-circle" size={12} color="#fff" />
                    <Text style={styles.errorTooltipText}>Max 365 days</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {pauseTab === 'date' && (
          <View>
            <CustomDatePicker
              value={pauseDate}
              onChange={setPauseDate}
              weekStart={preferences.weekStart}
            />
          </View>
        )}

        {pauseTab === 'indefinite' && (
          <View style={{alignItems: 'center', marginVertical: 12, paddingHorizontal: 16}}>
            <Text style={{color: colors.mutedText, fontFamily: fonts.bodyMedium, fontSize: 16, textAlign: 'center'}}>
              Your habit will remain paused until you manually resume it.
            </Text>
          </View>
        )}

        {(() => {
          const parsed = parseInt(pauseDaysText, 10);
          const isInvalid = pauseTab === 'days' && (isNaN(parsed) || parsed < 1 || parsed > 365);
          return (
            <Pressable
              onPress={handleConfirmPause}
              disabled={busy || isInvalid}
              style={{
                backgroundColor: isInvalid ? colors.surfaceLight : colors.accent,
                borderRadius: 24,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 16,
                opacity: isInvalid ? 0.5 : 1,
              }}>
              <Text style={{color: isInvalid ? colors.mutedText : '#fff', fontFamily: fonts.bodyBold, fontSize: 16}}>
                Pause
              </Text>
            </Pressable>
          );
        })()}
      </CustomModal>
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
    errorTooltip: {
      position: 'absolute',
      top: 52,
      backgroundColor: colors.danger,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      zIndex: 10,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    errorTooltipText: {
      color: '#fff',
      fontFamily: fonts.bodyBold,
      fontSize: 11,
    },
    tooltipArrow: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      marginLeft: -4,
      borderWidth: 4,
      borderColor: 'transparent',
      borderBottomColor: colors.danger,
    },
  });
