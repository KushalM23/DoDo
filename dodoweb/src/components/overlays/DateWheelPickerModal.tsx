"use client";

import { useEffect, useMemo, useState } from "react";
import { WheelColumn } from "./WheelColumn";
import {
  CalendarMonthWheelItem,
  TaskDateWheelItem,
  buildCalendarMonthItems,
  buildTaskDateItems,
  findCalendarMonthIndex,
  findTaskDateIndex,
  startOfLocalDay,
} from "./DateWheelPickerUtils";

type TaskDatePickerProps = {
  mode: "task-date";
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
};

type CalendarMonthPickerProps = {
  mode: "calendar-month";
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (value: { month: number; year: number }) => void;
};

type DateWheelPickerModalProps = TaskDatePickerProps | CalendarMonthPickerProps;

export function DateWheelPickerModal(props: DateWheelPickerModalProps) {
  const [taskTempDate, setTaskTempDate] = useState(() =>
    startOfLocalDay(props.value),
  );
  const [taskDateItems, setTaskDateItems] = useState<TaskDateWheelItem[]>(() =>
    buildTaskDateItems(startOfLocalDay(props.value)),
  );

  const taskSelectedIndex = useMemo(
    () => findTaskDateIndex(taskDateItems, taskTempDate),
    [taskDateItems, taskTempDate],
  );

  const [calendarTempDate, setCalendarTempDate] = useState(
    () => new Date(props.value.getFullYear(), props.value.getMonth(), 1),
  );
  const [calendarMonthItems, setCalendarMonthItems] = useState<
    CalendarMonthWheelItem[]
  >(() =>
    buildCalendarMonthItems(
      new Date(props.value.getFullYear(), props.value.getMonth(), 1),
    ),
  );

  const calendarSelectedIndex = useMemo(
    () => findCalendarMonthIndex(calendarMonthItems, calendarTempDate),
    [calendarMonthItems, calendarTempDate],
  );

  useEffect(() => {
    if (!props.visible) return;

    const nextValue = startOfLocalDay(props.value);
    setTaskTempDate(nextValue);
    setTaskDateItems(buildTaskDateItems(nextValue));

    const nextCalendarDate = new Date(
      nextValue.getFullYear(),
      nextValue.getMonth(),
      1,
    );
    setCalendarTempDate(nextCalendarDate);
    setCalendarMonthItems(buildCalendarMonthItems(nextCalendarDate));
  }, [props.value, props.visible]);

  if (!props.visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-3">
      <div className="absolute inset-0 bg-black/90" onClick={props.onClose} />

      <div
        className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-3xl bg-surface p-4 shadow-2xl">
          <div className="rounded-3xl bg-surface-light px-3 py-3">
            {props.mode === "task-date" ? (
              <WheelColumn
                items={taskDateItems.map((v) => v.label)}
                selectedIndex={taskSelectedIndex}
                onSelectedIndexChange={(index) => {
                  const newDate = taskDateItems[index]?.date;
                  if (newDate) {
                    setTaskTempDate(newDate);
                  }
                }}
                itemHeight={48}
                visibleRowCount={7}
              />
            ) : (
              <WheelColumn
                items={calendarMonthItems.map((v) => v.label)}
                selectedIndex={calendarSelectedIndex}
                onSelectedIndexChange={(index) => {
                  const newDate = calendarMonthItems[index]?.date;
                  if (newDate) {
                    setCalendarTempDate(newDate);
                  }
                }}
                itemHeight={48}
                visibleRowCount={7}
              />
            )}
          </div>

          <div className="mt-6">
            <button
              className="flex w-full items-center justify-center rounded-full bg-accent py-3.5"
              onClick={() => {
                if (props.mode === "task-date") {
                  props.onConfirm(taskTempDate);
                } else if (props.mode === "calendar-month") {
                  const selected = calendarMonthItems[calendarSelectedIndex];
                  if (selected) {
                    props.onConfirm({
                      month: selected.month,
                      year: selected.year,
                    });
                  }
                }
              }}
            >
              <span className="font-sans-bold text-base text-white">Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
