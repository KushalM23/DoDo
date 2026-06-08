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
import { CustomDatePicker } from "@/components/forms/pickers/CustomDatePicker";

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
  const [pauseVisible, setPauseVisible] = useState(false);
  const [pauseTab, setPauseTab] = useState<"days" | "date" | "indefinite">("days");
  const [pauseDays, setPauseDays] = useState(7);
  const [pauseDate, setPauseDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (pauseVisible) {
      const activeNode = tabRefs.current[pauseTab];
      if (activeNode) {
        setPillStyle({
          left: activeNode.offsetLeft,
          width: activeNode.offsetWidth,
        });
      }
    }
  }, [pauseTab, pauseVisible]);

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

  async function handleConfirmPause() {
    setBusy(true);
    try {
      let pausedUntil: string | null = null;
      if (pauseTab === "days") {
        const target = new Date();
        target.setDate(target.getDate() + pauseDays);
        pausedUntil = dateKey(target);
      } else if (pauseTab === "date") {
        pausedUntil = pauseDate;
      }
      await editHabit(currentHabit.id, {
        isPaused: true,
        pausedUntil,
      });
      setPauseVisible(false);
    } catch (error) {
      showAlert(
        "Failed to pause habit",
        error instanceof Error ? error.message : "Unable to pause habit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    showAlert(
      "Resume Habit",
      "Are you sure you want to resume this habit?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resume",
          onPress: async () => {
            setBusy(true);
            try {
              await editHabit(currentHabit.id, {
                isPaused: false,
                pausedUntil: null,
              });
            } catch (error) {
              showAlert(
                "Failed to resume habit",
                error instanceof Error ? error.message : "Unable to resume habit.",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
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
              headerRight={
                <button
                  type="button"
                  disabled={busy}
                  onClick={currentHabit.isPaused ? handleResume : () => setPauseVisible(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-text hover:bg-surface-light transition"
                  aria-label={currentHabit.isPaused ? "Resume habit" : "Pause habit"}
                >
                  <AppIcon
                    name={currentHabit.isPaused ? "play" : "pause"}
                    size={22}
                  />
                </button>
              }
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
                  disabled={currentHabit.isPaused}
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
                    currentHabit.isPaused && "opacity-55 cursor-not-allowed"
                  )}
                  disabled={currentHabit.isPaused || busy}
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
                disabled={currentHabit.isPaused}
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

      {pauseVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-black/90 cursor-default" onClick={() => setPauseVisible(false)} />
          <div className="relative w-full max-w-[380px] rounded-3xl bg-surface px-6 py-6 shadow-2xl z-10 border border-border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-[28px] tracking-[-0.5px] text-text">Pause Habit</h2>
              <button
                type="button"
                className="inline-grid h-10 w-10 place-items-center rounded-full text-muted-text hover:bg-surface-light transition"
                onClick={() => setPauseVisible(false)}
              >
                <AppIcon name="x" size={22} />
              </button>
            </div>

            <div className="relative flex gap-0 mb-4 bg-surface-light p-1 rounded-full overflow-hidden">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-accent transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  left: pillStyle.left,
                  width: pillStyle.width,
                }}
              />
              {(["days", "date", "indefinite"] as const).map((tab) => {
                const active = pauseTab === tab;
                const label = tab === "days" ? "Days" : tab === "date" ? "Date" : "Indefinite";
                return (
                  <button
                    key={tab}
                    type="button"
                    ref={(el) => {
                      tabRefs.current[tab] = el;
                    }}
                    onClick={() => setPauseTab(tab)}
                    className={cx(
                      "relative z-10 flex-1 py-1.5 rounded-full text-xs font-sans-bold transition-colors duration-200",
                      active
                        ? "text-white"
                        : "text-muted-text hover:text-text",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {pauseTab === "days" && (
              <div className="flex flex-col items-center my-6 gap-2">
                <span className="text-xs font-sans-bold text-muted-text uppercase tracking-wider">Pause duration</span>
                <div className="relative flex items-center justify-center">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={pauseDays === 0 ? "" : pauseDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setPauseDays(isNaN(val) ? 0 : val);
                    }}
                    className="w-32 text-center rounded-xl bg-surface-light border border-border px-3 py-2 text-2xl font-heading text-text focus:outline-none focus:border-accent"
                  />
                  {pauseTab === "days" && pauseDays > 365 && (
                    <div className="absolute top-full mt-2 bg-danger text-white text-xs font-sans-bold px-3 py-1.5 rounded-lg shadow-lg z-20 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <AppIcon name="alert-circle" size={14} />
                      <span>Max 365 days</span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-danger" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {pauseTab === "date" && (
              <div className="my-4">
                <CustomDatePicker
                  value={pauseDate}
                  onChange={setPauseDate}
                  weekStart={preferences.weekStart}
                />
              </div>
            )}

            {pauseTab === "indefinite" && (
              <div className="text-center my-6 px-4">
                <p className="text-muted-text font-sans-medium text-base leading-relaxed">
                  Your habit will remain paused until you manually resume it.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmPause}
              disabled={busy || (pauseTab === "days" && (pauseDays > 365 || pauseDays < 1))}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-accent py-3.5 font-sans-bold text-base text-white hover:bg-accent-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Pause
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
