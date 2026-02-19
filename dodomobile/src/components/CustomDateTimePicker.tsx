import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "./AppIcon";
import { colors, spacing, radii, fontSize } from "../theme/colors";

type Props = {
  value: Date;
  onChange: (date: Date) => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function CustomDateTimePicker({ value, onChange }: Props) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [hourInput, setHourInput] = useState("12");
  const [minuteInput, setMinuteInput] = useState("00");

  const selectedDay = value.getDate();
  const selectedMonth = value.getMonth();
  const selectedYear = value.getFullYear();

  const hours24 = value.getHours();
  const minutes = value.getMinutes();
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 || 12;

  useEffect(() => {
    setHourInput(String(hours12).padStart(2, "0"));
    setMinuteInput(String(minutes).padStart(2, "0"));
  }, [hours12, minutes]);

  const weeks = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(day: number) {
    const next = new Date(value);
    next.setFullYear(viewYear, viewMonth, day);
    onChange(next);
  }

  function applyTimeFromInputs(nextHourText: string, nextMinuteText: string, nextIsPm: boolean) {
    const parsedHour = Number(nextHourText);
    const parsedMinute = Number(nextMinuteText);
    if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) return;

    const clampedHour12 = Math.max(1, Math.min(12, Math.trunc(parsedHour)));
    const clampedMinute = Math.max(0, Math.min(59, Math.trunc(parsedMinute)));

    const hour24 = (clampedHour12 % 12) + (nextIsPm ? 12 : 0);
    const next = new Date(value);
    next.setHours(hour24, clampedMinute, 0, 0);

    setHourInput(String(clampedHour12).padStart(2, "0"));
    setMinuteInput(String(clampedMinute).padStart(2, "0"));
    onChange(next);
  }

  function toggleAmPm() {
    applyTimeFromInputs(hourInput, minuteInput, !isPM);
  }

  function applyHourInput(raw: string) {
    const clean = raw.replace(/[^0-9]/g, "").slice(0, 2);
    setHourInput(clean);
    if (clean.length !== 2) return;
    applyTimeFromInputs(clean, minuteInput || "0", isPM);
  }

  function applyMinuteInput(raw: string) {
    const clean = raw.replace(/[^0-9]/g, "").slice(0, 2);
    setMinuteInput(clean);
    if (clean.length !== 2) return;
    applyTimeFromInputs(hourInput || "12", clean, isPM);
  }

  const isSelectedMonth = viewMonth === selectedMonth && viewYear === selectedYear;
  const today = new Date();
  const isTodayMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthRow}>
        <Pressable onPress={prevMonth} hitSlop={12} style={styles.monthNavBtn}>
          <AppIcon name="chevron-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={styles.monthNavBtn}>
          <AppIcon name="chevron-right" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Day of week headers */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day == null) {
              return <View key={`e${di}`} style={styles.dayCell} />;
            }
            const sel = isSelectedMonth && day === selectedDay;
            const isToday = isTodayMonth && day === today.getDate() && !sel;
            return (
              <Pressable
                key={day}
                style={[styles.dayCell, sel && styles.dayCellSelected]}
                onPress={() => selectDay(day)}
              >
                <Text style={[styles.dayText, sel && styles.dayTextSelected, isToday && styles.dayTextToday]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Time picker */}
      <View style={styles.timeRow}>
        <View style={styles.timeInputWrap}>
          <TextInput
            style={styles.timeInput}
            value={hourInput}
            onChangeText={applyHourInput}
            onBlur={() => applyTimeFromInputs(hourInput || "12", minuteInput || "0", isPM)}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
            placeholder="HH"
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.timeColon}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={minuteInput}
            onChangeText={applyMinuteInput}
            onBlur={() => applyTimeFromInputs(hourInput || "12", minuteInput || "0", isPM)}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
            placeholder="MM"
            placeholderTextColor={colors.mutedText}
          />
        </View>

        <View style={styles.ampmGroup}>
          <Pressable onPress={() => isPM && toggleAmPm()} style={[styles.ampmBtn, !isPM && styles.ampmBtnActive]}>
            <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>AM</Text>
          </Pressable>
          <Pressable onPress={() => !isPM && toggleAmPm()} style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}>
            <Text style={[styles.ampmText, isPM && styles.ampmTextActive]}>PM</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  monthLabel: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayHeaderCell: {
    flex: 1,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeaderText: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  dayCell: {
    flex: 1,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CELL_SIZE / 2,
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
  },
  dayText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayTextToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timeInput: {
    minWidth: 48,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    paddingVertical: spacing.xs,
  },
  timeColon: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginHorizontal: spacing.xs,
  },
  ampmGroup: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  ampmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ampmBtnActive: {
    backgroundColor: colors.accentLight,
  },
  ampmText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  ampmTextActive: {
    color: colors.accent,
  },
});
