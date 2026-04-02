import React, { useEffect, useMemo, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { CustomDatePicker } from "@/components/forms/pickers/CustomDatePicker";
import { CustomDurationPicker } from "@/components/forms/pickers/CustomDurationPicker";
import { CustomTimePicker } from "@/components/forms/pickers/CustomTimePicker";
import { cx } from "@/lib/tw";
import { useAlert } from "@/providers/AlertContext";
import { formatDate, formatTime, toLocalDateKey } from "@/utils/dateTime";
import type { Category } from "@/types/category";
import type {
  DateFormatPreference,
  TimeFormatPreference,
  WeekStartPreference,
} from "@/types/preferences";
import type { CreateTaskInput, Priority } from "@/types/task";

type TaskFormProps = {
  visible: boolean;
  variant?: "modal" | "panel";
  categories: Category[];
  defaultDate: string;
  defaultCategoryId: string | null;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  weekStart: WeekStartPreference;
  onCancel: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
};

function roundToNextInterval(date: Date, intervalMinutes: number): Date {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const remainder = minutes % intervalMinutes;
  const delta = remainder === 0 ? 0 : intervalMinutes - remainder;
  next.setMinutes(minutes + delta, 0, 0);
  return next;
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

export function TaskForm({
  visible,
  variant = "modal",
  categories,
  defaultDate,
  defaultCategoryId,
  dateFormat,
  timeFormat,
  weekStart,
  onCancel,
  onSubmit,
}: TaskFormProps) {
  const isPanel = variant === "panel";
  const { showAlert } = useAlert();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId,
  );
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("");

  function resetToDefaults() {
    setTitle("");
    setPriority(2);
    setDurationMinutes(60);
    setCategoryId(defaultCategoryId);
    setActiveTab("");

    const [year, month, day] = defaultDate.split("-").map(Number);
    const validDate =
      Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
    const initialDate = validDate
      ? new Date(year, (month || 1) - 1, day || 1)
      : new Date();
    const roundedTime = roundToNextInterval(new Date(), 5);
    initialDate.setHours(
      roundedTime.getHours(),
      roundedTime.getMinutes(),
      0,
      0,
    );

    setScheduledDate(toLocalDateKey(initialDate));
    setScheduledTime(
      `${String(initialDate.getHours()).padStart(2, "0")}:${String(
        initialDate.getMinutes(),
      ).padStart(2, "0")}`,
    );
  }

  useEffect(() => {
    if (!visible) {
      return;
    }
    resetToDefaults();
  }, [defaultCategoryId, defaultDate, visible]);

  const selectedCat = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );

  async function handleSubmit() {
    if (!title.trim()) {
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      showAlert("Invalid duration", "Duration must be at least 1 minute.");
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      showAlert("Invalid time", "Please pick a valid date and time.");
      return;
    }

    setBusy(true);
    try {
      const deadline = new Date(
        scheduledAt.getTime() + durationMinutes * 60 * 1000,
      );
      await onSubmit({
        title: title.trim(),
        description: "",
        categoryId,
        scheduledAt: scheduledAt.toISOString(),
        deadline: deadline.toISOString(),
        durationMinutes,
        priority,
      });
      if (isPanel) {
        resetToDefaults();
      } else {
        onCancel();
      }
    } catch (error) {
      showAlert(
        "Failed to create task",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!visible) {
    return null;
  }

  const priorityColor =
    priority === 3
      ? "var(--high-priority)"
      : priority === 2
      ? "var(--medium-priority)"
      : "var(--low-priority)";

  return (
    <div>
      <div
        className={cx(
          "relative w-full max-w-[760px] h-[720px] overflow-hidden rounded-[24px] bg-surface px-5 pb-5 pt-5 sm:px-7 sm:pb-7 flex flex-col",
        )}
      >
        <div className="mb-4 grid gap-3 flex-shrink-0">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Dodo's task"
            autoFocus
            className="h-[50px] w-full rounded-full bg-surface-light px-8 font-display font-bold text-[26px] tracking-[-0.5px] text-text outline-none placeholder:text-muted-text focus:ring-0"
          />
        </div>

        <div className="mb-2 grid gap-3 flex-shrink-0">
          <div className="flex gap-3">
            <button
              type="button"
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3",
                activeTab === "date"
                  ? "bg-accent text-white"
                  : "bg-surface-light text-muted-text",
              )}
              onClick={() => setActiveTab(activeTab === "date" ? "" : "date")}
            >
              <AppIcon
                name="calendar"
                size={16}
                color={activeTab === "date" ? "#fff" : "var(--muted-text)"}
              />
              <span className="font-sans-bold text-xs">
                {formatDate(new Date(`${scheduledDate}T00:00:00`), dateFormat)}
              </span>
            </button>

            <button
              type="button"
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3",
                activeTab === "time"
                  ? "bg-accent text-white"
                  : "bg-surface-light text-muted-text",
              )}
              onClick={() => setActiveTab(activeTab === "time" ? "" : "time")}
            >
              <AppIcon
                name="clock"
                size={16}
                color={activeTab === "time" ? "#fff" : "var(--muted-text)"}
              />
              <span className="font-sans-bold text-xs">
                {formatTime(
                  new Date(`${scheduledDate}T${scheduledTime}:00`),
                  timeFormat,
                )}
              </span>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3",
                activeTab === "priority"
                  ? "bg-accent text-white"
                  : "bg-surface-light text-muted-text",
              )}
              onClick={() =>
                setActiveTab(activeTab === "priority" ? "" : "priority")
              }
            >
              <AppIcon
                name={
                  priority === 3
                    ? "arrow-up-circle"
                    : priority === 2
                    ? "minus-circle"
                    : "arrow-down-circle"
                }
                size={16}
                color={activeTab === "priority" ? "#fff" : priorityColor}
              />
              <span className="font-sans-bold text-xs">
                {priority === 3 ? "High" : priority === 2 ? "Med" : "Low"}
              </span>
            </button>

            <button
              type="button"
              className={cx(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3",
                activeTab === "duration"
                  ? "bg-accent text-white"
                  : "bg-surface-light text-muted-text",
              )}
              onClick={() =>
                setActiveTab(activeTab === "duration" ? "" : "duration")
              }
            >
              <AppIcon
                name="hourglass"
                size={16}
                color={activeTab === "duration" ? "#fff" : "var(--muted-text)"}
              />
              <span className="font-sans-bold text-xs">
                {formatDurationSmart(durationMinutes)}
              </span>
            </button>

            {categories.length > 0 && (
              <button
                type="button"
                className={cx(
                  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3",
                  activeTab === "category" || selectedCat?.color
                    ? "bg-accent text-white"
                    : "bg-surface-light text-muted-text",
                )}
                style={
                  activeTab !== "category" && selectedCat?.color
                    ? { backgroundColor: selectedCat.color }
                    : undefined
                }
                onClick={() =>
                  setActiveTab(activeTab === "category" ? "" : "category")
                }
              >
                <AppIcon
                  name={(selectedCat?.icon ?? "package") as AppIconName}
                  size={16}
                  color={
                    activeTab === "category" || selectedCat?.color
                      ? "#fff"
                      : "var(--muted-text)"
                  }
                />
                <span className="font-sans-bold text-xs text-inherit">
                  {selectedCat?.name ?? "Category"}
                </span>
              </button>
            )}
          </div>
        </div>

        {activeTab !== "" && (
          <div className="pt-3 flex-1 overflow-y-auto min-h-0">
            {activeTab === "priority" && (
              <div>
                <span className="mb-3 block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
                  Priority Level
                </span>
                <div className="flex flex-wrap gap-3">
                  {([1, 2, 3] as Priority[]).map((value) => {
                    const active = priority === value;
                    const color =
                      value === 3
                        ? "var(--high-priority)"
                        : value === 2
                        ? "var(--medium-priority)"
                        : "var(--low-priority)";
                    return (
                      <button
                        key={value}
                        type="button"
                        className="flex min-w-[30%] flex-1 items-center justify-center gap-2 rounded-full py-3.5"
                        style={{
                          backgroundColor: active
                            ? color
                            : "var(--surface-light)",
                        }}
                        onClick={() => setPriority(value)}
                      >
                        <AppIcon
                          name={
                            value === 3
                              ? "arrow-up-circle"
                              : value === 2
                              ? "minus-circle"
                              : "arrow-down-circle"
                          }
                          size={18}
                          color={active ? "#fff" : "var(--muted-text)"}
                        />
                        <span
                          className={cx(
                            "font-sans-bold text-sm",
                            active ? "text-white" : "text-muted-text",
                          )}
                        >
                          {value === 1
                            ? "Low"
                            : value === 2
                            ? "Medium"
                            : "High"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "date" && (
              <CustomDatePicker
                value={scheduledDate}
                onChange={setScheduledDate}
                weekStart={weekStart}
              />
            )}

            {activeTab === "time" && (
              <CustomTimePicker
                value={scheduledTime}
                onChange={setScheduledTime}
                timeFormat={timeFormat}
              />
            )}

            {activeTab === "duration" && (
              <CustomDurationPicker
                value={durationMinutes}
                onChange={setDurationMinutes}
              />
            )}

            {activeTab === "category" && (
              <div>
                <span className="mb-3 block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
                  Select Category
                </span>
                <div className="flex flex-wrap gap-3">
                  {categories.map((category) => {
                    const active = categoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className="flex items-center gap-2 rounded-full px-4 py-3"
                        style={{
                          backgroundColor: active
                            ? category.color
                            : "var(--surface-light)",
                        }}
                        onClick={() =>
                          setCategoryId(active ? null : category.id)
                        }
                      >
                        <AppIcon
                          name={category.icon as AppIconName}
                          size={16}
                          color={active ? "#fff" : "var(--muted-text)"}
                        />
                        <span
                          className={cx(
                            "text-sm",
                            active
                              ? "font-sans-bold text-white"
                              : "font-sans-medium text-muted-text",
                          )}
                        >
                          {category.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "" && <div className="flex-1" />}

        <div className="mt-5 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-[14px] text-white disabled:opacity-60"
            disabled={busy || !title.trim()}
          >
            <AppIcon name="plus" size={18} color="#fff" />
            <span className="font-sans-bold text-base">
              {busy ? "Adding..." : "Add"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
