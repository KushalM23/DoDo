import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HabitComposer } from "@/components/forms/HabitComposer";
import { AppIcon } from "@/components/common/AppIcon";
import { FocusModeView } from "@/components/common/FocusModeView";
import { HoldToConfirmButton } from "@/components/common/HoldToConfirmButton";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { cx, tw } from "@/lib/tw";
import { useAlert } from "@/providers/AlertContext";
import { useHabits } from "@/providers/HabitsContext";
import { usePreferences } from "@/providers/PreferencesContext";
import { backOrReplace } from "@/utils/navigation";
import {
  buildHabitTrackerDateKeys,
  formatHabitFrequency,
  habitAppliesToDate,
  minuteToLabel,
} from "@/utils/habits";

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitDetailScreen() {
  const params = useParams<{ habitId: string }>();
  const habitId = typeof params.habitId === "string" ? params.habitId : "";
  const router = useRouter();
  const { showAlert } = useAlert();
  const { preferences } = usePreferences();
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
  const composerPanelRef = useRef<HTMLElement | null>(null);

  const habit = habits.find((entry) => entry.id === habitId);
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
    const timer = window.setInterval(() => setLockTime(new Date()), 1000);
    return () => window.clearInterval(timer);
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
    void startHabitTimer(habit.id, todayKey);
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
      <div className="grid items-start justify-items-center">
        <div className="grid w-full max-w-[1080px] gap-2 rounded-panel border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]">
          <h1 className={tw.h1}>Habit not found</h1>
          <Link
            href="/habits"
            className="inline-flex min-h-12.5 items-center justify-center gap-2 rounded-full bg-accent px-4.5 font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
          >
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
      showAlert(
        "Failed",
        error instanceof Error ? error.message : "Unable to update completion.",
      );
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
          "Failed to pause timer",
          error instanceof Error
            ? error.message
            : "Unable to pause focus timer.",
        );
      }
    }
  }

  function handlePanelBack() {
    backOrReplace(router, "/habits");
  }

  function focusComposerPanel() {
    composerPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={
          canCompleteToday ? (completedToday ? "Undo" : "Complete") : "Edit"
        }
        actionIconName={
          canCompleteToday ? (completedToday ? "rotate-ccw" : "check") : "edit"
        }
        actionDisabled={busy && canCompleteToday}
        actionDone={canCompleteToday && completedToday}
        onActionPress={() => {
          if (canCompleteToday) {
            void toggleTodayCompletion();
            return;
          }
          focusComposerPanel();
        }}
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 items-start justify-items-center">
      <section className="h-full w-full max-w-[1240px] p-2 sm:p-3 md:p-4">
        <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div
            ref={(node) => {
              composerPanelRef.current = node;
            }}
            className="h-full overflow-hidden"
          >
            <HabitComposer
              mode="edit"
              initialValues={currentHabit}
              timeFormat={preferences.timeFormat}
              panelBackOnClick={handlePanelBack}
              onSubmit={(input) => editHabit(currentHabit.id, input)}
            />
          </div>

          <aside className="flex h-full flex-col p-5 xl:border-l xl:border-border">
            <div className="mt-6 grid gap-3">
              <div className="flex gap-3">
                <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-light px-3">
                  <AppIcon name="flame" size={14} color="var(--muted-text)" />
                  <span className="font-sans-bold text-xs text-muted-text">
                    {currentHabit.currentStreak} Current
                  </span>
                </div>
                <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-light px-3">
                  <AppIcon name="flame" size={14} color="var(--muted-text)" />
                  <span className="font-sans-bold text-xs text-muted-text">
                    {currentHabit.bestStreak} Best
                  </span>
                </div>
              </div>

              <div className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface-light px-3">
                <AppIcon name="repeat" size={14} color="var(--muted-text)" />
                <span className="font-sans-bold text-xs text-muted-text">
                  {formatHabitFrequency(currentHabit)}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-[20px] p-2">
              <div className="flex flex-wrap gap-y-6">
                {trackerDateKeys.map((key) => {
                  const completed = isHabitCompletedOn(currentHabit.id, key);
                  const isFuture = key > todayKey;
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className="grid w-[14.28%] place-items-center"
                    >
                      <span
                        className={cx(
                          "h-6 w-6 rounded-full bg-surface-light",
                          completed && !isFuture && "bg-habit-badge",
                          isToday && "border-[3px] border-text",
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1" />

            <div className="grid gap-4">
              <div className="grid place-items-center">
                <HoldToConfirmButton
                  iconName="lock"
                  onHoldComplete={() => setLockInMode(true)}
                  holdDurationMs={1500}
                  size={64}
                />
              </div>

              {canCompleteToday ? (
                <button
                  type="button"
                  className={cx(
                    tw.action,
                    "w-full justify-center",
                    completedToday
                      ? "bg-surface-light text-accent"
                      : tw.actionAccent,
                  )}
                  disabled={busy}
                  onClick={() => {
                    void toggleTodayCompletion();
                  }}
                >
                  <AppIcon
                    name={completedToday ? "rotate-ccw" : "check"}
                    size={18}
                  />
                  <span>{completedToday ? "Undo" : "Complete"}</span>
                </button>
              ) : null}

              <button
                type="button"
                className="inline-flex min-h-12.5 w-full items-center justify-center gap-2 rounded-full bg-danger px-4.5 font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() =>
                  showAlert(
                    "Delete Habit",
                    "This will remove the habit and its history.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void removeHabit(currentHabit.id).then(() =>
                            router.replace("/habits"),
                          );
                        },
                      },
                    ],
                  )
                }
              >
                <AppIcon name="trash-2" size={18} />
                <span>Delete</span>
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
