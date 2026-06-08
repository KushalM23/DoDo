import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  mode?: "create" | "edit";
  initialValues?: Habit | null;
  timeFormat?: TimeFormatPreference;
  panelBackHref?: string;
  panelBackOnClick?: () => void;
  onSubmit: (input: CreateHabitInput) => Promise<void>;
  headerRight?: React.ReactNode;
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
  mode = "create",
  initialValues,
  timeFormat = "12h",
  panelBackHref,
  panelBackOnClick,
  onSubmit,
  headerRight,
}: HabitComposerProps) {
  const isStackedPanelEditor = mode === "edit";
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
  const loadedEditHabitIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastAutoSavedSignatureRef = useRef("");
  const autoSaveErrorShownRef = useRef(false);

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
    if (mode === "edit") {
      if (!initialValues) {
        return;
      }
      if (loadedEditHabitIdRef.current === initialValues.id) {
        return;
      }
      loadedEditHabitIdRef.current = initialValues.id;
    } else {
      loadedEditHabitIdRef.current = null;
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

    if (initialValues) {
      lastAutoSavedSignatureRef.current = [
        initialValues.title,
        initialValues.icon,
        initialValues.frequencyType,
        initialValues.intervalDays ?? "none",
        [...(initialValues.customDays ?? [])].sort((a, b) => a - b).join(","),
        initialValues.timeMinute ?? "none",
        initialValues.durationMinutes ?? "none",
      ].join("|");
    } else {
      lastAutoSavedSignatureRef.current = "";
    }

    autoSaveErrorShownRef.current = false;
  }, [initialValues, mode]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const signature = [
    title.trim(),
    icon,
    frequencyType,
    frequencyType === "interval" ? intervalDays : "none",
    frequencyType === "custom_days"
      ? [...customDays].sort((a, b) => a - b).join(",")
      : "none",
    parseTimeText(timeValue),
    durationMinutes,
  ].join("|");

  useEffect(() => {
    if (!isStackedPanelEditor || !initialValues || busy || !title.trim()) {
      return;
    }

    if (signature === lastAutoSavedSignatureRef.current) {
      return;
    }

    if (frequencyType === "custom_days" && customDays.length === 0) {
      return;
    }

    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      setBusy(true);
      void onSubmit({
        title: title.trim(),
        icon,
        anchorDate:
          initialValues.anchorDate ?? new Date().toISOString().slice(0, 10),
        frequencyType,
        intervalDays: frequencyType === "interval" ? intervalDays : null,
        customDays: frequencyType === "custom_days" ? customDays : [],
        timeMinute: parseTimeText(timeValue),
        durationMinutes,
      })
        .then(() => {
          lastAutoSavedSignatureRef.current = signature;
          autoSaveErrorShownRef.current = false;
        })
        .catch((error) => {
          if (!autoSaveErrorShownRef.current) {
            showAlert(
              "Failed to save habit",
              error instanceof Error
                ? error.message
                : "Unable to save changes.",
            );
            autoSaveErrorShownRef.current = true;
          }
        })
        .finally(() => {
          setBusy(false);
        });
    }, 450);
  }, [
    busy,
    customDays,
    durationMinutes,
    frequencyType,
    icon,
    initialValues,
    intervalDays,
    isStackedPanelEditor,
    onSubmit,
    showAlert,
    signature,
    timeValue,
    title,
  ]);

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

  const iconPicker = (
    <div>
      <span className="mb-3 block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
        Select Icon
      </span>
      {isStackedPanelEditor ? (
        <div className="grid grid-cols-6 gap-2.5 pb-2 sm:grid-cols-7">
          {HABIT_ICON_OPTIONS.map((option) => {
            const active = option === icon;
            return (
              <button
                key={option}
                type="button"
                className={cx(
                  "inline-grid place-items-center justify-self-center rounded-full",
                  isStackedPanelEditor ? "h-12 w-12" : "h-13 w-13",
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
      ) : (
        <div className="flex -mx-3 overflow-x-auto px-3 pb-2 scrollbar-none">
          <div className="flex flex-nowrap gap-2.5">
            {HABIT_ICON_OPTIONS.map((option) => {
              const active = option === icon;
              return (
                <button
                  key={option}
                  type="button"
                  className={cx(
                    "inline-grid h-13 w-13 shrink-0 place-items-center rounded-full",
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
      )}
    </div>
  );

  const frequencyPicker = (
    <div className="grid gap-4">
      <span className="block font-sans-bold text-xs uppercase tracking-[0.5px] text-muted-text">
        Frequency
      </span>
      <div className="flex flex-wrap gap-3">
        {(["daily", "interval", "custom_days"] as HabitFrequencyType[]).map(
          (value) => {
            const active = frequencyType === value;
            return (
              <button
                key={value}
                type="button"
                className={cx(
                  "flex min-w-[30%] flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm",
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
          },
        )}
      </div>

      {frequencyType === "interval" ? (
        <div className="flex items-center justify-center gap-3 rounded-full bg-surface-light px-6 py-3">
          <span className="font-sans-medium text-sm text-text">
            Repeat every
          </span>
          <input
            className="w-18 rounded-full bg-surface px-3 py-1.5 text-center font-sans-bold text-base text-text outline-none"
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
              setIntervalDays(Math.max(2, Math.min(365, Number(clean) || 2)));
            }}
          />
          <span className="font-sans-medium text-sm text-text">days</span>
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
                  "min-h-10 w-[13.5%] rounded-full px-1 text-xs",
                  active
                    ? "bg-habit-badge text-text font-sans-bold"
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
  );

  const formBody = (
    <div
      className={cx(
        "relative w-full overflow-hidden flex flex-col",
        isStackedPanelEditor
          ? "rounded-none bg-transparent"
          : "rounded-3xl bg-surface",
        isStackedPanelEditor
          ? "px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
          : "px-5 pb-5 pt-5 sm:px-7 sm:pb-7",
        "h-full",
      )}
    >
      <div className={cx("mb-4 flex-shrink-0", isStackedPanelEditor && "mb-3")}>
        {isStackedPanelEditor ? (
          <div className="grid min-h-13 grid-cols-[40px_minmax(0,1fr)_40px] items-center">
            <div className="flex items-center justify-start">
              {panelBackOnClick ? (
                <button
                  type="button"
                  onClick={panelBackOnClick}
                  className="inline-flex items-center gap-1.5 text-muted-text"
                  aria-label="Go back"
                >
                  <AppIcon name="chevron-left" size={24} />
                </button>
              ) : panelBackHref ? (
                <Link
                  href={panelBackHref}
                  className="inline-flex items-center gap-1.5 text-muted-text"
                >
                  <AppIcon name="chevron-left" size={24} />
                </Link>
              ) : null}
            </div>

            <div className="inline-flex min-w-0 items-center justify-self-center gap-4">
              <AppIcon name={iconName} size={24} color="var(--habit-badge)" />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Habit name"
                size={Math.max(title.trim().length, 1)}
                className="-ml-px w-auto max-w-[22ch] min-w-0 border-0 bg-transparent p-0 text-left font-display text-[34px] tracking-[-0.8px] text-text outline-none focus:ring-0 md:text-[40px]"
              />
            </div>

            <div className="flex items-center justify-end">
              {headerRight}
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Habit name"
              className="h-12.5 w-full rounded-full bg-surface-light px-8 font-display font-bold text-[26px] tracking-[-0.5px] text-text outline-none placeholder:text-muted-text focus:ring-0"
            />
          </div>
        )}
      </div>

      {isStackedPanelEditor ? (
        <div className="min-h-0 flex-1 pr-1">
          <div className="grid content-start gap-3 pb-1">
            {iconPicker}
            {frequencyPicker}

            <div>
              <span className={tw.fieldLabel}>Time</span>
              <CustomTimePicker
                value={timeValue}
                onChange={setTimeValue}
                timeFormat={timeFormat}
              />
            </div>

            <div>
              <CustomDurationPicker
                value={durationMinutes}
                onChange={setDurationMinutes}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!isStackedPanelEditor ? (
        <>
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
                  color={
                    activeTab === "frequency" ? "#fff" : "var(--muted-text)"
                  }
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
                  color={
                    activeTab === "duration" ? "#fff" : "var(--muted-text)"
                  }
                />
                <span className="font-sans-bold text-xs">
                  {formatDurationSmart(durationMinutes)}
                </span>
              </button>
            </div>
          </div>

          {activeTab !== "" ? (
            <div className="min-h-0 flex-1 overflow-y-auto pt-3">
              {activeTab === "icon" ? iconPicker : null}

              {activeTab === "frequency" ? frequencyPicker : null}

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
        </>
      ) : null}

      <div
        className={cx("flex-shrink-0", isStackedPanelEditor ? "mt-0" : "mt-5")}
      >
        {!isStackedPanelEditor ? (
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-white disabled:opacity-60"
            disabled={busy || !title.trim()}
          >
            <AppIcon name="plus" size={18} color="#fff" />
            <span className="font-sans-bold text-base">
              {busy ? "Adding..." : "Add Habit"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );

  return formBody;
}
