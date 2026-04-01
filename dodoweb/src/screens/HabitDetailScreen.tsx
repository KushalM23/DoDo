import React, {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {HabitComposer} from '@/components/forms/HabitComposer';
import {AppIcon} from '@/components/common/AppIcon';
import {FocusModeView} from '@/components/common/FocusModeView';
import {HoldToConfirmButton} from '@/components/common/HoldToConfirmButton';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {cx, tw} from '@/lib/tw';
import {useAlert} from '@/providers/AlertContext';
import {useHabits} from '@/providers/HabitsContext';
import {usePreferences} from '@/providers/PreferencesContext';
import {buildHabitTrackerDateKeys, formatHabitFrequency, habitAppliesToDate, minuteToLabel} from '@/utils/habits';
import {formatClockDuration} from '@/utils/taskTiming';

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitDetailScreen() {
  const params = useParams<{habitId: string}>();
  const habitId = typeof params.habitId === 'string' ? params.habitId : '';
  const router = useRouter();
  const {showAlert} = useAlert();
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

  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const habit = habits.find(entry => entry.id === habitId);
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
  }, [habit, loadHistory, todayKey, trackerDateKeys]);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = window.setInterval(() => setLockTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [lockInMode]);

  const completedToday = habit ? isHabitCompletedOn(habit.id, todayKey) : false;
  const canCompleteToday = habit ? habitAppliesToDate(habit, todayKey) : false;

  useEffect(() => {
    if (!lockInMode || !habit || !canCompleteToday || completedToday || habit.timerStartedAt) {
      return;
    }
    void startHabitTimer(habit.id, todayKey);
  }, [canCompleteToday, completedToday, habit, lockInMode, startHabitTimer, todayKey]);

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
      <div className="grid items-start justify-items-center">
        <div className="grid w-full max-w-[1080px] gap-2 rounded-[28px] border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]">
          <h1 className={tw.h1}>Habit not found</h1>
          <Link href="/habits" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55">
            Back to habits
          </Link>
        </div>
      </div>
    );
  }
  const currentHabit = habit;

  async function toggleTodayCompletion() {
    setBusy(true);
    try {
      await setHabitCompletedOn(currentHabit.id, todayKey, !completedToday);
    } catch (error) {
      showAlert('Failed', error instanceof Error ? error.message : 'Unable to update completion.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExitFocus() {
    setLockInMode(false);
    if (currentHabit.timerStartedAt && !completedToday && canCompleteToday) {
      try {
        await pauseHabitTimer(currentHabit.id, todayKey);
      } catch (error) {
        showAlert(
          'Failed to pause timer',
          error instanceof Error ? error.message : 'Unable to pause focus timer.',
        );
      }
    }
  }

  if (lockInMode) {
    return (
      <FocusModeView
        now={lockTime}
        timeFormat={preferences.timeFormat}
        title={currentHabit.title}
        metaLines={[
          formatHabitFrequency(currentHabit),
          minuteToLabel(currentHabit.timeMinute, preferences.timeFormat),
        ]}
        infoIconName={currentHabit.icon as any}
        infoIconColor="var(--habit-badge)"
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'}
        actionIconName={canCompleteToday ? (completedToday ? 'rotate-ccw' : 'check') : 'edit'}
        onActionPress={() => {
          if (canCompleteToday) {
            void toggleTodayCompletion();
            return;
          }
          setEditVisible(true);
        }}
        actionDisabled={busy && canCompleteToday}
        actionDone={canCompleteToday && completedToday}
      />
    );
  }

  return (
    <div className="grid items-start justify-items-center">
      <section className="w-full max-w-[1080px] rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/habits" className="mb-4 inline-flex items-center gap-1.5 text-muted-text">
              <AppIcon name="chevron-left" size={18} />
              <span>Back to habits</span>
            </Link>
            <div className="flex items-center gap-3">
              <AppIcon name={currentHabit.icon as any} size={28} color="var(--habit-badge)" />
              <h1 className={tw.h1}>{currentHabit.title}</h1>
            </div>
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span>Current streak</span>
            <strong>{currentHabit.currentStreak}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span>Best streak</span>
            <strong>{currentHabit.bestStreak}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span>Time</span>
            <strong>{minuteToLabel(currentHabit.timeMinute, preferences.timeFormat)}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span>Duration</span>
            <strong>
              {currentHabit.durationMinutes
                ? `${currentHabit.durationMinutes}m`
                : formatClockDuration(focusElapsedSeconds)}
            </strong>
          </div>
        </div>

        <div className="mt-6 rounded-[22px] bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2>Tracker</h2>
              <p>{formatHabitFrequency(currentHabit)}</p>
            </div>
          </div>
          <div className="mt-[18px] flex flex-wrap gap-3">
            {trackerDateKeys.map(key => {
              const completed = isHabitCompletedOn(currentHabit.id, key);
              const isToday = key === todayKey;
              return (
                <span
                  key={key}
                  className={cx(
                    'aspect-square w-[calc(14.28%-11px)] rounded-full bg-surface-light',
                    completed && 'bg-habit-badge',
                    isToday && 'ring-2 ring-text',
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <HoldToConfirmButton
            iconName="lock"
            onHoldComplete={() => setLockInMode(true)}
            holdDurationMs={1500}
            size={84}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={cx(
                tw.action,
                'w-full',
                canCompleteToday && completedToday ? 'bg-surface-light text-accent' : tw.actionAccent,
              )}
              disabled={busy && canCompleteToday}
              onClick={() => {
                if (canCompleteToday) {
                  void toggleTodayCompletion();
                  return;
                }
                setEditVisible(true);
              }}>
              <AppIcon name={canCompleteToday && completedToday ? 'rotate-ccw' : canCompleteToday ? 'check' : 'edit'} size={18} />
              <span>
                {canCompleteToday ? (completedToday ? 'Undo' : 'Complete') : 'Edit'}
              </span>
            </button>

            <button
              type="button"
              className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-danger px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() =>
                showAlert('Delete Habit', 'This will remove the habit and its history.', [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void removeHabit(currentHabit.id).then(() => router.push('/habits'));
                    },
                  },
                ])
              }>
              <AppIcon name="trash-2" size={18} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </section>

      <HabitComposer
        open={editVisible}
        mode="edit"
        initialValues={currentHabit}
        onClose={() => setEditVisible(false)}
        onSubmit={input => editHabit(currentHabit.id, input)}
      />
    </div>
  );
}

