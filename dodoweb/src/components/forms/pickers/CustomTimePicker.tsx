import React, { useEffect, useState } from "react";
import { cx } from "@/lib/tw";
import type { TimeFormatPreference } from "@/types/preferences";

export function CustomTimePicker({
  value,
  onChange,
  timeFormat = "12h",
}: {
  value: string;
  onChange: (time: string) => void;
  timeFormat?: TimeFormatPreference;
}) {
  const [hourInput, setHourInput] = useState("12");
  const [minuteInput, setMinuteInput] = useState("00");
  const [isPM, setIsPM] = useState(false);

  useEffect(() => {
    if (!value) {
      return;
    }

    const [h, m] = value.split(":");
    const hh = Number(h);
    const mm = m ?? "00";
    const pm = hh >= 12;

    setIsPM(pm);
    if (timeFormat === "24h") {
      setHourInput(String(Math.max(0, Math.min(23, hh))).padStart(2, "0"));
    } else {
      const hours12 = hh % 12 || 12;
      setHourInput(String(hours12).padStart(2, "0"));
    }
    setMinuteInput(mm.padStart(2, "0"));
  }, [timeFormat, value]);

  function applyTimeFromInputs(
    nextHourText: string,
    nextMinuteText: string,
    nextIsPm: boolean,
  ) {
    const parsedHour = Number(nextHourText);
    const parsedMinute = Number(nextMinuteText);
    if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
      return;
    }

    const clampedMinute = Math.max(0, Math.min(59, Math.trunc(parsedMinute)));
    let hour24 = 0;

    if (timeFormat === "24h") {
      const clampedHour24 = Math.max(0, Math.min(23, Math.trunc(parsedHour)));
      hour24 = clampedHour24;
      setHourInput(String(clampedHour24).padStart(2, "0"));
    } else {
      const clampedHour12 = Math.max(1, Math.min(12, Math.trunc(parsedHour)));
      hour24 = (clampedHour12 % 12) + (nextIsPm ? 12 : 0);
      setHourInput(String(clampedHour12).padStart(2, "0"));
    }

    setMinuteInput(String(clampedMinute).padStart(2, "0"));
    onChange(
      `${String(hour24).padStart(2, "0")}:${String(clampedMinute).padStart(
        2,
        "0",
      )}`,
    );
  }

  return (
    <div className="mt-1 rounded-full border border-border bg-surface-light p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center rounded-full border border-border bg-surface px-4 py-1.5">
          <input
            className="min-h-0 w-12 appearance-none border-0 bg-transparent px-0 py-1 text-center font-sans-bold text-lg text-text outline-none focus-visible:outline-none focus-visible:ring-0"
            value={hourInput}
            onChange={(event) => {
              const clean = event.target.value
                .replace(/[^0-9]/g, "")
                .slice(0, 2);
              setHourInput(clean);
              if (clean.length !== 2) {
                return;
              }
              applyTimeFromInputs(clean, minuteInput || "0", isPM);
            }}
            onBlur={() =>
              applyTimeFromInputs(
                hourInput || (timeFormat === "24h" ? "00" : "12"),
                minuteInput || "0",
                isPM,
              )
            }
          />
          <span className="mx-1 font-sans-bold text-lg text-text">:</span>
          <input
            className="min-h-0 w-12 appearance-none border-0 bg-transparent px-0 py-1 text-center font-sans-bold text-lg text-text outline-none focus-visible:outline-none focus-visible:ring-0"
            value={minuteInput}
            onChange={(event) => {
              const clean = event.target.value
                .replace(/[^0-9]/g, "")
                .slice(0, 2);
              setMinuteInput(clean);
              if (clean.length !== 2) {
                return;
              }
              applyTimeFromInputs(
                hourInput || (timeFormat === "24h" ? "00" : "12"),
                clean,
                isPM,
              );
            }}
            onBlur={() =>
              applyTimeFromInputs(
                hourInput || (timeFormat === "24h" ? "00" : "12"),
                minuteInput || "0",
                isPM,
              )
            }
          />
        </div>

        {timeFormat === "12h" && (
          <div className="flex overflow-hidden rounded-full border border-border bg-surface">
            <button
              type="button"
              className={cx(
                "px-4 py-2 font-sans-bold text-lg",
                !isPM ? "bg-accent text-white" : "text-muted-text",
              )}
              onClick={() => {
                if (!isPM) {
                  return;
                }
                setIsPM(false);
                applyTimeFromInputs(hourInput, minuteInput, false);
              }}
            >
              AM
            </button>
            <button
              type="button"
              className={cx(
                "px-4 py-2 font-sans-bold text-lg",
                isPM ? "bg-accent text-white" : "text-muted-text",
              )}
              onClick={() => {
                if (isPM) {
                  return;
                }
                setIsPM(true);
                applyTimeFromInputs(hourInput, minuteInput, true);
              }}
            >
              PM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
