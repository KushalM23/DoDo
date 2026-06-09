import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { FocusModeView } from "@/components/common/FocusModeView";
import { HoldToConfirmButton } from "@/components/common/HoldToConfirmButton";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { CustomDatePicker } from "@/components/forms/pickers/CustomDatePicker";
import { CustomDurationPicker } from "@/components/forms/pickers/CustomDurationPicker";
import { CustomTimePicker } from "@/components/forms/pickers/CustomTimePicker";
import { cx, tw } from "@/lib/tw";
import { useAlert } from "@/providers/AlertContext";
import { useCategories } from "@/providers/CategoriesContext";
import { usePreferences } from "@/providers/PreferencesContext";
import { useTasks } from "@/providers/TasksContext";
import { hapticImpact } from "@/utils/haptics";
import { formatDateTime } from "@/utils/dateTime";
import { getTaskTrackedSeconds } from "@/utils/taskTiming";
import type { CreateTaskInput, Priority, Task } from "@/types/task";

function priorityLabel(priority: Priority) {
  return priority === 3 ? "High" : priority === 2 ? "Medium" : "Low";
}

function priorityIcon(priority: Priority): AppIconName {
  if (priority === 3) {
    return "arrow-up-circle";
  }
  if (priority === 2) {
    return "minus-circle";
  }
  return "arrow-down-circle";
}

function priorityColor(priority: Priority) {
  if (priority === 3) {
    return "var(--high-priority)";
  }
  if (priority === 2) {
    return "var(--medium-priority)";
  }
  return "var(--low-priority)";
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

export function TaskDetailScreen() {
  const params = useParams<{ taskId: string }>();
  const taskId = typeof params.taskId === "string" ? params.taskId : "";
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    tasks,
    loading,
    initialized,
    startTimer,
    pauseTimer,
    toggleTaskCompletion,
    removeTask,
    updateTaskDetails,
  } = useTasks();
  const { categories, initialized: categoriesInitialized } = useCategories();
  const { preferences } = usePreferences();

  const task = tasks.find((entry) => entry.id === taskId);
  const [titleDraft, setTitleDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<Priority>(2);
  const [scheduledDateDraft, setScheduledDateDraft] = useState("");
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState("");
  const [durationMinutesDraft, setDurationMinutesDraft] = useState(60);
  const [categoryIdDraft, setCategoryIdDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const [savingDetails, setSavingDetails] = useState(false);

  const autoSaveTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const lastAutoSavedSignatureRef = useRef("");
  const autoSaveErrorShownRef = useRef(false);

  useEffect(() => {
    if (!task) {
      return;
    }
    const scheduledAt = new Date(task.scheduledAt);
    setTitleDraft(task.title);
    setPriorityDraft(task.priority);
    setScheduledDateDraft(scheduledAt.toISOString().slice(0, 10));
    setScheduledTimeDraft(
      `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(
        scheduledAt.getMinutes(),
      ).padStart(2, "0")}`,
    );
    setDurationMinutesDraft(getTaskDurationMinutes(task));
    setCategoryIdDraft(task.categoryId);
    lastAutoSavedSignatureRef.current = "";
    autoSaveErrorShownRef.current = false;
  }, [task]);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = window.setInterval(() => setLockTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [lockInMode]);

  useEffect(() => {
    if (!lockInMode || !task || task.completed || task.timerStartedAt) {
      return;
    }
    void startTimer(task);
  }, [lockInMode, startTimer, task]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      if (undoTimerRef.current != null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const category = task?.categoryId
    ? categories.find((entry) => entry.id === task.categoryId) ?? null
    : null;
  const focusElapsedSeconds = useMemo(
    () => (task ? getTaskTrackedSeconds(task, lockTime) : 0),
    [lockTime, task],
  );

  const hasChanges = useMemo(() => {
    if (!task) {
      return false;
    }
    const originalDuration = getTaskDurationMinutes(task);
    const scheduledAt = new Date(task.scheduledAt);
    const originalDate = scheduledAt.toISOString().slice(0, 10);
    const originalTime = `${String(scheduledAt.getHours()).padStart(
      2,
      "0",
    )}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`;

    return (
      titleDraft.trim() !== task.title ||
      priorityDraft !== task.priority ||
      categoryIdDraft !== task.categoryId ||
      durationMinutesDraft !== originalDuration ||
      scheduledDateDraft !== originalDate ||
      scheduledTimeDraft !== originalTime
    );
  }, [
    categoryIdDraft,
    durationMinutesDraft,
    priorityDraft,
    scheduledDateDraft,
    scheduledTimeDraft,
    task,
    titleDraft,
  ]);

  useEffect(() => {
    if (
      !task ||
      busy ||
      pendingDelete ||
      savingDetails ||
      !hasChanges ||
      !titleDraft.trim()
    ) {
      return;
    }
    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    const signature = [
      titleDraft.trim(),
      priorityDraft,
      categoryIdDraft ?? "none",
      durationMinutesDraft,
      scheduledDateDraft,
      scheduledTimeDraft,
    ].join("|");

    if (signature === lastAutoSavedSignatureRef.current) {
      return;
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      const scheduledAt = new Date(
        `${scheduledDateDraft}T${scheduledTimeDraft}:00`,
      );
      const deadline = new Date(
        scheduledAt.getTime() + durationMinutesDraft * 60 * 1000,
      );

      const input: CreateTaskInput = {
        title: titleDraft.trim(),
        description: task.description ?? "",
        categoryId: categoryIdDraft,
        scheduledAt: scheduledAt.toISOString(),
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
        .catch((error) => {
          if (!autoSaveErrorShownRef.current) {
            showAlert(
              "Failed to update task",
              error instanceof Error ? error.message : "Unknown error",
            );
            autoSaveErrorShownRef.current = true;
          }
        })
        .finally(() => {
          setSavingDetails(false);
        });
    }, 450);
  }, [
    busy,
    categoryIdDraft,
    durationMinutesDraft,
    hasChanges,
    priorityDraft,
    pendingDelete,
    savingDetails,
    scheduledDateDraft,
    scheduledTimeDraft,
    showAlert,
    task,
    titleDraft,
    updateTaskDetails,
  ]);

  if (
    !initialized ||
    !categoriesInitialized ||
    (loading && tasks.length === 0)
  ) {
    return <LoadingScreen title="Loading task" />;
  }

  if (!task) {
    return (
      <div className="grid items-start justify-items-center">
        <div className="grid w-full max-w-[1080px] gap-2 rounded-panel border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]">
          <h1 className={tw.h1}>Task not found</h1>
          <Link
            href="/tasks"
            className="inline-flex min-h-12.5 items-center justify-center gap-2 rounded-full bg-accent px-4.5 font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }
  const currentTask = task;
  const fallbackScheduledAt = new Date(currentTask.scheduledAt);
  const safeScheduledDate =
    scheduledDateDraft || fallbackScheduledAt.toISOString().slice(0, 10);
  const safeScheduledTime =
    scheduledTimeDraft ||
    `${String(fallbackScheduledAt.getHours()).padStart(2, "0")}:${String(
      fallbackScheduledAt.getMinutes(),
    ).padStart(2, "0")}`;

  function clearUndoTimer() {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function scheduleDelete(taskId: string) {
    clearUndoTimer();
    setPendingDelete(true);
    undoTimerRef.current = window.setTimeout(() => {
      void removeTask(taskId).then(() => router.push("/tasks"));
      setPendingDelete(false);
      undoTimerRef.current = null;
    }, 3000);
  }

  async function handleComplete() {
    if (pendingDelete) {
      return;
    }
    setBusy(true);
    try {
      await toggleTaskCompletion(currentTask);
    } finally {
      setBusy(false);
    }
  }

  async function handleExitFocus() {
    setLockInMode(false);
    hapticImpact("soft");
    if (!currentTask.completed && currentTask.timerStartedAt) {
      try {
        await pauseTimer(currentTask);
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

  function handleDelete() {
    if (busy || pendingDelete || savingDetails) {
      return;
    }

    showAlert("Delete task?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          scheduleDelete(currentTask.id);
        },
      },
    ]);
  }

  if (lockInMode) {
    return (
      <FocusModeView
        now={lockTime}
        timeFormat={preferences.timeFormat}
        title={currentTask.title}
        metaLines={[
          `${category?.name ?? "None"} · ${priorityLabel(
            currentTask.priority,
          )}`,
          `Due ${formatDateTime(currentTask.deadline, {
            dateFormat: preferences.dateFormat,
            timeFormat: preferences.timeFormat,
            weekStart: preferences.weekStart,
          })}`,
        ]}
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={currentTask.completed ? "Undo" : "Complete"}
        actionIconName={currentTask.completed ? "rotate-ccw" : "check"}
        onActionPress={() => {
          void handleComplete();
        }}
        actionDisabled={busy || savingDetails}
        actionDone={currentTask.completed}
      />
    );
  }

  if (pendingDelete) {
    return (
      <div className="grid items-start justify-items-center">
        <section className="grid w-full max-w-[1080px] gap-2 rounded-panel border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]">
          <h1 className={tw.h1}>Task deleted</h1>
          <p className={tw.muted}>Removing task...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 items-start justify-items-center">
      <section className="h-full w-full max-w-[1240px] p-2 sm:p-3 md:p-4">
        <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="flex h-full flex-col p-4 md:p-6">
            <div className="grid min-h-13 grid-cols-[40px_minmax(0,1fr)_40px] items-center">
              <div className="flex items-center justify-start">
                <Link
                  href="/tasks"
                  className="inline-flex items-center gap-1.5 text-muted-text"
                >
                  <AppIcon name="chevron-left" size={24} />
                </Link>
              </div>

              <div className="inline-flex min-w-0 justify-self-center">
                <input
                  size={Math.max(titleDraft.trim().length, 1)}
                  className="w-auto max-w-[22ch] min-w-0 border-0 bg-transparent p-0 text-center font-display text-[34px] tracking-[-0.8px] text-text outline-none focus:ring-0 md:text-[42px]"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
              </div>

              <div aria-hidden="true" className="h-6 w-6 justify-self-end" />
            </div>
            <div className="mt-6 grid flex-1 content-start gap-5 overflow-y-auto pr-1">
              <div>
                <span className={tw.fieldLabel}>Time</span>
                <CustomTimePicker
                  value={safeScheduledTime}
                  onChange={setScheduledTimeDraft}
                  timeFormat={preferences.timeFormat}
                />
              </div>

              <div>
                <CustomDurationPicker
                  value={durationMinutesDraft}
                  onChange={setDurationMinutesDraft}
                />
              </div>

              <div>
                <span className={tw.fieldLabel}>Priority Level</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  {([1, 2, 3] as Priority[]).map((value) => {
                    const active = priorityDraft === value;
                    const chipColor = priorityColor(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        className={cx(
                          "flex min-w-[30%] flex-1 items-center justify-center gap-2 rounded-full py-4 transition hover:-translate-y-px",
                          active
                            ? "text-white"
                            : "bg-surface-light text-muted-text hover:brightness-110",
                        )}
                        style={
                          active ? { backgroundColor: chipColor } : undefined
                        }
                        onClick={() => setPriorityDraft(value)}
                      >
                        <AppIcon
                          name={priorityIcon(value)}
                          size={18}
                          color={active ? "#fff" : "currentColor"}
                        />
                        <span className="font-sans-bold text-sm">
                          {priorityLabel(value)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <span className={tw.fieldLabel}>Category</span>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {categories.map((entry) => {
                      const active = categoryIdDraft === entry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className="flex items-center gap-2.5 rounded-full px-5 py-3.5 transition hover:-translate-y-px"
                          style={{
                            backgroundColor: active
                              ? entry.color
                              : "var(--surface-light)",
                            color: active ? "#fff" : "var(--muted-text)",
                          }}
                          onClick={() => {
                            setCategoryIdDraft(active ? null : entry.id);
                          }}
                        >
                          <AppIcon
                            name={entry.icon as AppIconName}
                            size={16}
                            color={active ? "#fff" : "currentColor"}
                          />
                          <span
                            className={cx(
                              "text-sm",
                              active
                                ? "font-sans-bold text-white"
                                : "font-sans-medium text-text",
                            )}
                          >
                            {entry.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="flex h-full flex-col p-5 xl:border-l xl:border-border">
            <div>
              <CustomDatePicker
                value={safeScheduledDate}
                onChange={setScheduledDateDraft}
                weekStart={preferences.weekStart}
              />
            </div>

            <div className="flex-1" />

            <div className="grid gap-4">
              <div className="grid place-items-center">
                <HoldToConfirmButton
                  iconName="lock"
                  onHoldComplete={() => {
                    setLockInMode(true);
                    hapticImpact("heavy");
                  }}
                  holdDurationMs={1500}
                  size={64}
                />
              </div>

              <button
                type="button"
                className={cx(
                  tw.action,
                  "w-full justify-center",
                  currentTask.completed
                    ? "bg-surface text-accent"
                    : tw.actionAccent,
                )}
                disabled={busy || pendingDelete || savingDetails}
                onClick={() => {
                  void handleComplete();
                }}
              >
                <AppIcon
                  name={currentTask.completed ? "rotate-ccw" : "check"}
                  size={18}
                />
                <span>{currentTask.completed ? "Undo" : "Complete"}</span>
              </button>

              <button
                type="button"
                className="inline-flex min-h-12.5 w-full items-center justify-center gap-2 rounded-full bg-danger px-4.5 font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
                disabled={busy || pendingDelete || savingDetails}
                onClick={handleDelete}
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
