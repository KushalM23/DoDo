import React, { useEffect, useState } from "react";
import { cx } from "@/lib/tw";

const DURATION_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "4h", value: 240 },
  { label: "5h", value: 300 },
];

export function CustomDurationPicker({
  value,
  onChange,
  showQuickSelect = true,
}: {
  value: number;
  onChange: (minutes: number) => void;
  showQuickSelect?: boolean;
}) {
  const [unit, setUnit] = useState<"min" | "hour">("min");
  const [customText, setCustomText] = useState(String(value));

  useEffect(() => {
    if (value >= 60 && value % 60 === 0) {
      setUnit("hour");
      setCustomText(String(value / 60));
    } else {
      setUnit("min");
      setCustomText(String(value));
    }
  }, [value]);

  function customToMinutes(raw: string, u: "min" | "hour") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return value;
    const base = u === "hour" ? parsed * 60 : parsed;
    return Math.max(1, Math.min(1440, Math.round(base)));
  }

  return (
    <div className="grid gap-4">
      {showQuickSelect && (
        <>
          <label className="mb-[-4px] block font-sans-bold text-[12px] uppercase tracking-[0.5px] text-muted-text">
            Duration
          </label>
          <div className="flex -mx-4 overflow-x-auto px-4 scrollbar-none">
            <div className="flex flex-nowrap items-center gap-2.5 pb-2">
              {DURATION_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cx(
                      "shrink-0 rounded-full px-4 py-3 font-sans-medium text-sm",
                      active
                        ? "bg-accent text-white"
                        : "bg-surface-light text-text",
                    )}
                    onClick={() => onChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!showQuickSelect && (
        <label className="mb-[-2px] block font-sans-bold text-[12px] uppercase tracking-[0.5px] text-muted-text">
          Duration
        </label>
      )}

      <div className="flex overflow-hidden rounded-[28px] border border-border bg-surface-light p-1 pl-4">
        <input
          className="min-h-0 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent px-2 py-2 text-lg font-sans-medium text-text outline-none focus:ring-0 placeholder:text-muted-text"
          value={customText}
          onChange={(e) => {
            const raw = e.target.value;
            const allowDecimal = unit === "hour";
            const clean = allowDecimal
              ? raw
                  .replace(/[^0-9.]/g, "")
                  .replace(/(\..*)\./g, "$1")
                  .slice(0, 5)
              : raw.replace(/[^0-9]/g, "").slice(0, 4);
            setCustomText(clean);
            if (clean.length > 0) onChange(customToMinutes(clean, unit));
          }}
          onBlur={() => {
            const normalized = customToMinutes(customText, unit);
            onChange(normalized);
            const display =
              unit === "hour"
                ? Math.max(1, Math.round(normalized / 60))
                : normalized;
            setCustomText(String(display));
          }}
          placeholder="Custom"
        />
        <div className="flex rounded-full bg-surface p-1">
          <button
            type="button"
            className={cx(
              "rounded-full px-4 font-sans-bold text-sm transition duration-200",
              unit === "min"
                ? "bg-accent text-white"
                : "text-muted-text hover:text-text",
            )}
            onClick={() => {
              const cm = customToMinutes(customText, unit);
              setUnit("min");
              setCustomText(String(cm));
              onChange(cm);
            }}
          >
            min
          </button>
          <button
            type="button"
            className={cx(
              "rounded-full px-4 font-sans-bold text-sm transition duration-200",
              unit === "hour"
                ? "bg-accent text-white"
                : "text-muted-text hover:text-text",
            )}
            onClick={() => {
              const cm = customToMinutes(customText, unit);
              setUnit("hour");
              setCustomText(String(Math.max(1, Math.round(cm / 60))));
              onChange(cm);
            }}
          >
            hour
          </button>
        </div>
      </div>
    </div>
  );
}
