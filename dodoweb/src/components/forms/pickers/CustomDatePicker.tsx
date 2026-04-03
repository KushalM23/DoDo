import { useMemo, useState } from "react";
import { AppIcon } from "@/components/common/AppIcon";
import { cx } from "@/lib/tw";
import { getCalendarOffset, getWeekdayLabels } from "@/utils/dateTime";
import type { WeekStartPreference } from "@/types/preferences";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CustomDatePicker({
  value, // "YYYY-MM-DD"
  onChange,
  weekStart = "sunday",
}: {
  value: string;
  onChange: (date: string) => void;
  weekStart?: WeekStartPreference;
}) {
  const selectedDate = new Date(`${value}T00:00:00`);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const dayLabels = getWeekdayLabels(weekStart);

  const weeks = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getCalendarOffset(
      getFirstDayOfWeek(viewYear, viewMonth),
      weekStart,
    );
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth, weekStart]);

  const selDay = selectedDate.getDate();
  const selMonth = selectedDate.getMonth();
  const selYear = selectedDate.getFullYear();

  const isSelectedMonth = viewMonth === selMonth && viewYear === selYear;
  const today = new Date();
  const isTodayMonth =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();

  function selectDay(day: number) {
    const next = new Date(viewYear, viewMonth, day);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
  }

  return (
    <div className="mt-1 flex h-100 flex-col rounded-3xl bg-surface-light p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else setViewMonth((m) => m - 1);
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-text"
        >
          <AppIcon name="chevron-left" size={20} />
        </button>
        <span className="font-heading text-3xl tracking-tight text-text">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else setViewMonth((m) => m + 1);
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-text"
        >
          <AppIcon name="chevron-right" size={20} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-7">
        {dayLabels.map((lbl, i) => (
          <div
            key={i}
            className="text-center font-sans-medium text-xs uppercase leading-3.5 text-muted-text"
          >
            {lbl}
          </div>
        ))}
      </div>

      <div className="grid gap-1 flex-1 content-start">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day == null) return <div key={`e${di}`} />;
              const sel = isSelectedMonth && day === selDay;
              const isToday = isTodayMonth && day === today.getDate() && !sel;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cx(
                    "flex h-12 w-12 items-center justify-center rounded-full font-sans-medium text-base",
                    sel
                      ? "bg-text font-sans-bold text-background"
                      : isToday
                      ? "font-sans-bold text-accent"
                      : "text-text",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
