import React, { useEffect, useMemo, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { CustomDurationPicker } from "@/components/forms/pickers/CustomDurationPicker";
import { CustomTimePicker } from "@/components/forms/pickers/CustomTimePicker";
import { cx, tw } from "@/lib/tw";
import { useAlert } from "@/providers/AlertContext";
import type {
  CreateHabitInput,
  Habit,
  HabitFrequencyType,
  HabitIcon,
} from "@/types/habit";
import type { TimeFormatPreference } from "@/types/preferences";
import { DEFAULT_HABIT_ICON, HABIT_ICON_OPTIONS } from "@/types/habit";
import { minuteToLabel } from "@/utils/habits";

const WEEK_DAYS = [
  { id: 0, label: "Sun" },
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
] as const;

type HabitComposerProps = {
  open: boolean;
  variant?: "modal" | "panel";
  mode?: "create" | "edit";
  initialValues?: Habit | null;
  timeFormat?: TimeFormatPreference;
  resetSignal?: number;
  onClose: () => void;
  onSubmit: (input: CreateHabitInput) => Promise<void>;
};

function formatDurationSmart(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainder}m`;
}

function toTimeText(timeMinute: number | null | undefined): string {
  const minute = Math.max(0, Math.min(1439, timeMinute ?? 9 * 60));
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTimeText(value: string): number {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const safeHours = Number.isFinite(hours)
    ? Math.max(0, Math.min(23, Math.floor(hours)))
    : 9;
  const safeMinutes = Number.isFinite(minutes)
    ? Math.max(0, Math.min(59, Math.floor(minutes)))
    : 0;
  return safeHours * 60 + safeMinutes;
}

export function HabitComposer({
  open,
  variant = "modal",
  mode = "create",
  initialValues,
  timeFormat = "12h",
  resetSignal,
  onClose,
  onSubmit,
}: HabitComposerProps) {
  const isPanel = variant === "panel";
  const visible = isPanel || open;
  const { showAlert } = useAlert();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [frequencyType, setFrequencyType] =
    useState<HabitFrequencyType>("daily");
  const [intervalDays, setIntervalDays] = useState(2);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [timeValue, setTimeValue] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("");

  const iconName = icon as AppIconName;

  const frequencyLabel = useMemo(() => {
    if (frequencyType === "daily") {
      return "Daily";
    }
    if (frequencyType === "interval") {
      return `${intervalDays} Days`;
    }
    return `${customDays.length}/wk`;
  }, [customDays.length, frequencyType, intervalDays]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle(initialValues?.title ?? "");
    setIcon(initialValues?.icon ?? DEFAULT_HABIT_ICON);
    setFrequencyType(initialValues?.frequencyType ?? "daily");
    setIntervalDays(initialValues?.intervalDays ?? 2);
    setCustomDays(initialValues?.customDays ?? []);
    setTimeValue(toTimeText(initialValues?.timeMinute));
    setDurationMinutes(initialValues?.durationMinutes ?? 60);
    setBusy(false);
    setActiveTab("");
  }, [initialValues, mode, resetSignal, visible]);

  if (!visible) {
    return null;
  }

  async function handleSubmit() {
    if (!title.trim()) {
      return;
    }
    if (frequencyType === "custom_days" && customDays.length === 0) {
      showAlert(
        "Missing days",
        "Choose at least one day for custom frequency.",
      );
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        icon,
        anchorDate: new Date().toISOString().slice(0, 10),
        frequencyType,
        intervalDays: frequencyType === "interval" ? intervalDays : null,
        customDays: frequencyType === "custom_days" ? customDays : [],
        timeMinute: parseTimeText(timeValue),
        durationMinutes,
      });

      if (!isPanel) {
        onClose();
        return;
      }

      if (mode === "create") {
        setTitle("");
        setIcon(DEFAULT_HABIT_ICON);
        setFrequencyType("daily");
        setIntervalDays(2);
        setCustomDays([]);
        setTimeValue("09:00");
        setDurationMinutes(60);
        setActiveTab("");
      }
    } finally {
      setBusy(false);
    }
  }

  const formBody = (
    <div
      className={cx(
        "relative w-full overflow-hidden rounded-[24px] bg-surface px-5 pb-5 pt-5 sm:px-7 sm:pb-7 flex flex-col",
        isPanel
          ? "h-[720px]"
          : "h-[min(720px,calc(100vh-120px))] max-w-[760px]",
      )}
    >
      {!isPanel ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className={tw.h2}>
            {mode === "edit" ? "Edit Habit" : "New Habit"}
          </h3>
          <button type="button" className={tw.iconBtn} onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>
      ) : (
        <h2 className="mb-4 text-center font-display text-[34px] tracking-[-0.5px] text-text">
          {mode === "edit" ? "Edit Habit" : "New Habit"}
        </h2>
      )}

      <div className="mb-4 grid gap-3 flex-shrink-0">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Habit name"
          autoFocus={!isPanel}
          className="h-[50px] w-full rounded-full bg-surface-light px-8 font-display font-bold text-[26px] tracking-[-0.5px] text-text outline-none placeholder:text-muted-text focus:ring-0"
        />
      </div>

      <div className="mb-2 grid gap-3 flex-shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cx(
              "flex min-h-11 items-center justify-center gap-2 rounded-full px-3",
              activeTab === "icon"
                ? "bg-accent text-white"
                : "bg-surface-light text-muted-text",
            )}
            onClick={() => setActiveTab(activeTab === "icon" ? "" : "icon")}
          >
            <AppIcon
              name={iconName}
              size={16}
              color={activeTab === "icon" ? "#fff" : "var(--muted-text)"}
            />
            <span className="font-sans-bold text-xs">Icon</span>
          </button>

          <button
            type="button"
            className={cx(
              "flex min-h-11 items-center justify-center gap-2 rounded-full px-3",
              activeTab === "frequency"
                ? "bg-accent text-white"
                : "bg-surface-light text-muted-text",
            )}
            onClick={() =>
              setActiveTab(activeTab === "frequency" ? "" : "frequency")
            }
          >
            <AppIcon
              name="repeat"
              size={16}
              color={activeTab === "frequency" ? "#fff" : "var(--muted-text)"}
            />
            <span className="font-sans-bold text-xs">{frequencyLabel}</span>
          </button>

          <button
            type="button"
            className={cx(
              "flex min-h-11 items-center justify-center gap-2 rounded-full px-3",
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
              {minuteToLabel(parseTimeText(timeValue), timeFormat)}
            </span>
          </button>

          <button
            type="button"
            className={cx(
              "flex min-h-11 items-center justify-center gap-2 rounded-full px-3",
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
        </div>
      </div>

      {activeTab !== "" ? (
        <div className="min-h-0 flex-1 overflow-y-auto pt-3">
          {activeTab === "icon" ? (
            <div>
              <span className="mb-3 block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
                Select Icon
              </span>
              <div className="flex -mx-3 overflow-x-auto px-3 pb-2 scrollbar-none">
                <div className="flex flex-nowrap gap-2.5">
                  {HABIT_ICON_OPTIONS.map((option) => {
                    const active = option === icon;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={cx(
                          "inline-grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full",
                          active ? "bg-habit-badge" : "bg-surface-light",
                        )}
                        onClick={() => setIcon(option)}
                      >
                        <AppIcon
                          name={option as AppIconName}
                          size={24}
                          color={active ? "#fff" : "var(--muted-text)"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "frequency" ? (
            <div className="grid gap-4">
              <span className="block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
                Frequency
              </span>
              <div className="flex flex-wrap gap-3">
                {(
                  ["daily", "interval", "custom_days"] as HabitFrequencyType[]
                ).map((value) => {
                  const active = frequencyType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={cx(
                        "flex min-w-[30%] flex-1 items-center justify-center rounded-full px-3 py-3 text-sm",
                        active
                          ? "bg-accent text-white font-sans-bold"
                          : "bg-surface-light text-text font-sans-medium",
                      )}
                      onClick={() => setFrequencyType(value)}
                    >
                      {value === "daily"
                        ? "Every day"
                        : value === "interval"
                        ? "Every X days"
                        : "Custom days"}
                    </button>
                  );
                })}
              </div>

              {frequencyType === "interval" ? (
                <div className="flex items-center justify-center gap-3 rounded-full bg-surface-light px-6 py-3">
                  <span className="font-sans-medium text-sm text-text">
                    Repeat every
                  </span>
                  <input
                    className="w-[72px] rounded-full bg-surface px-3 py-1.5 text-center font-sans-bold text-base text-text outline-none"
                    inputMode="numeric"
                    value={String(intervalDays)}
                    onChange={(event) => {
                      const clean = event.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 3);
                      if (!clean) {
                        setIntervalDays(2);
                        return;
                      }
                      setIntervalDays(
                        Math.max(2, Math.min(365, Number(clean) || 2)),
                      );
                    }}
                  />
                  <span className="font-sans-medium text-sm text-text">
                    days
                  </span>
                </div>
              ) : null}

              {frequencyType === "custom_days" ? (
                <div className="flex justify-between gap-2">
                  {WEEK_DAYS.map((day) => {
                    const active = customDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        className={cx(
                          "min-h-11 w-[13.5%] rounded-full px-1 text-[11px]",
                          active
                            ? "bg-habit-badge-light text-habit-badge font-sans-bold"
                            : "bg-surface-light text-muted-text font-sans-medium",
                        )}
                        onClick={() => {
                          setCustomDays((prev) =>
                            prev.includes(day.id)
                              ? prev.filter((entry) => entry !== day.id)
                              : [...prev, day.id].sort((a, b) => a - b),
                          );
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "time" ? (
            <CustomTimePicker
              value={timeValue}
              onChange={setTimeValue}
              timeFormat={timeFormat}
            />
          ) : null}

          {activeTab === "duration" ? (
            <CustomDurationPicker
              value={durationMinutes}
              onChange={setDurationMinutes}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="mt-5 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-[14px] text-white disabled:opacity-60"
          disabled={busy || !title.trim()}
        >
          <AppIcon
            name={mode === "edit" ? "check" : "plus"}
            size={18}
            color="#fff"
          />
          <span className="font-sans-bold text-base">
            {busy
              ? mode === "edit"
                ? "Saving..."
                : "Adding..."
              : mode === "edit"
              ? "Save Habit"
              : "Add Habit"}
          </span>
        </button>

        {!isPanel ? (
          <button
            type="button"
            className="mt-3 w-full text-center font-sans-medium text-sm text-muted-text"
            onClick={onClose}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );

  if (isPanel) {
    return formBody;
  }

  return (
    <div className={tw.modalOverlay}>
      <div className={tw.modalBackdrop} onClick={onClose} />
      <div
        className={cx(tw.modalCardWide, "relative")}
        role="dialog"
        aria-modal="true"
      >
        {formBody}
      </div>
    </div>
  );
}
