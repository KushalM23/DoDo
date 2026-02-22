import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "./AppIcon";
import { CustomDateTimePicker } from "./CustomDateTimePicker";
import { DEFAULT_HABIT_ICON, HABIT_ICON_OPTIONS, type CreateHabitInput, type Habit, type HabitFrequencyType, type HabitIcon } from "../types/habit";
import { fontSize, radii, spacing } from "../theme/colors";
import { type ThemeColors, useThemeColors, useThemeMode } from "../theme/ThemeProvider";
import { usePreferences } from "../state/PreferencesContext";
import { minuteToLabel } from "../utils/habits";

type HabitFormProps = {
  visible: boolean;
  mode?: "create" | "edit";
  initialValues?: Habit;
  onCancel: () => void;
  onSubmit: (payload: CreateHabitInput) => Promise<void>;
};

const WEEK_DAYS = [
  { id: 0, label: "Sun" },
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
];

function localDateKey(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitForm({ visible, mode = "create", initialValues, onCancel, onSubmit }: HabitFormProps) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preferences } = usePreferences();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>("daily");
  const [intervalDays, setIntervalDays] = useState("2");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [timeValue, setTimeValue] = useState(new Date());
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState<"min" | "hour">("min");
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  function customToMinutes(raw: string, unit: "min" | "hour") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 30;
    const base = unit === "hour" ? parsed * 60 : parsed;
    return Math.max(1, Math.min(720, Math.trunc(base)));
  }

  useEffect(() => {
    if (!visible) return;

    const base = new Date();
    if (initialValues?.timeMinute != null) {
      base.setHours(Math.floor(initialValues.timeMinute / 60), initialValues.timeMinute % 60, 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }

    setTitle(initialValues?.title ?? "");
    setIcon(initialValues?.icon ?? DEFAULT_HABIT_ICON);
    setFrequencyType(initialValues?.frequencyType ?? "daily");
    setIntervalDays(String(initialValues?.intervalDays ?? 2));
    setCustomDays(initialValues?.customDays ?? []);
    setDurationValue(String(initialValues?.durationMinutes ?? 30));
    setDurationUnit("min");
    setTimeValue(base);
    setShowPicker(false);
  }, [visible, initialValues]);

  function toggleCustomDay(day: number) {
    setCustomDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function handleSubmit() {
    if (!title.trim()) return;

    const parsedInterval = Math.max(2, Math.min(365, Number(intervalDays) || 2));
    const parsedDuration = customToMinutes(durationValue, durationUnit);
    if (frequencyType === "custom_days" && customDays.length === 0) {
      Alert.alert("Missing days", "Choose at least one day for custom frequency.");
      return;
    }

    const minute = timeValue.getHours() * 60 + timeValue.getMinutes();

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        icon,
        anchorDate: localDateKey(new Date()),
        frequencyType,
        intervalDays: frequencyType === "interval" ? parsedInterval : null,
        customDays: frequencyType === "custom_days" ? customDays : [],
        timeMinute: minute,
        durationMinutes: parsedDuration,
      });
      onCancel();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Unable to save habit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.popup} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.heading}>{mode === "edit" ? "Edit Habit" : "New Habit"}</Text>
              <Pressable onPress={onCancel} hitSlop={12}>
                <AppIcon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Habit name"
              placeholderTextColor={colors.mutedText}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={styles.label}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {HABIT_ICON_OPTIONS.map((iconName) => {
                const active = iconName === icon;
                return (
                  <Pressable
                    key={iconName}
                    style={[styles.iconChip, active && styles.iconChipActive]}
                    onPress={() => setIcon(iconName)}
                  >
                    <AppIcon name={iconName} size={16} color={active ? colors.habitBadge : colors.mutedText} />
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.chip, frequencyType === "daily" && styles.chipActive]}
                onPress={() => setFrequencyType("daily")}
              >
                <Text style={[styles.chipText, frequencyType === "daily" && styles.chipTextActive]}>Every day</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, frequencyType === "interval" && styles.chipActive]}
                onPress={() => setFrequencyType("interval")}
              >
                <Text style={[styles.chipText, frequencyType === "interval" && styles.chipTextActive]}>Every X days</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, frequencyType === "custom_days" && styles.chipActive]}
                onPress={() => setFrequencyType("custom_days")}
              >
                <Text style={[styles.chipText, frequencyType === "custom_days" && styles.chipTextActive]}>Custom days</Text>
              </Pressable>
            </View>

            {frequencyType === "interval" && (
              <View style={styles.intervalRow}>
                <TextInput
                  style={styles.intervalInput}
                  keyboardType="number-pad"
                  value={intervalDays}
                  onChangeText={(raw) => setIntervalDays(raw.replace(/[^0-9]/g, "").slice(0, 3))}
                  placeholder="2"
                  placeholderTextColor={colors.mutedText}
                />
                <Text style={styles.intervalHint}>days</Text>
              </View>
            )}

            {frequencyType === "custom_days" && (
              <View style={styles.daysGrid}>
                {WEEK_DAYS.map((day) => {
                  const active = customDays.includes(day.id);
                  return (
                    <Pressable
                      key={day.id}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => toggleCustomDay(day.id)}
                    >
                      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowPicker((v) => !v)}>
              <AppIcon name="clock" size={16} color={colors.accent} />
              <Text style={styles.pickerText}>{minuteToLabel(timeValue.getHours() * 60 + timeValue.getMinutes(), preferences.timeFormat)}</Text>
              <AppIcon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showPicker && (
              <CustomDateTimePicker
                key={`habit-form-picker-${themeMode}`}
                value={timeValue}
                onChange={setTimeValue}
                timeFormat={preferences.timeFormat}
                weekStart={preferences.weekStart}
                mode="time"
              />
            )}

            <Text style={styles.label}>Duration</Text>
            <View style={styles.customDurationRow}>
              <TextInput
                style={styles.customDurationInput}
                keyboardType="number-pad"
                value={durationValue}
                onChangeText={(raw) => setDurationValue(raw.replace(/[^0-9]/g, "").slice(0, 3))}
                onBlur={() => {
                  const normalized = customToMinutes(durationValue, durationUnit);
                  const display = durationUnit === "hour" ? Math.max(1, Math.round(normalized / 60)) : normalized;
                  setDurationValue(String(display));
                }}
                placeholder="30"
                placeholderTextColor={colors.mutedText}
              />
              <View style={styles.unitToggleTrack}>
                <Pressable
                  style={[styles.unitToggleOption, durationUnit === "min" && styles.unitToggleOptionActive]}
                  onPress={() => {
                    const currentMinutes = customToMinutes(durationValue, durationUnit);
                    setDurationUnit("min");
                    setDurationValue(String(currentMinutes));
                  }}
                >
                  <Text style={[styles.unitToggleText, durationUnit === "min" && styles.unitToggleTextActive]}>min</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitToggleOption, durationUnit === "hour" && styles.unitToggleOptionActive]}
                  onPress={() => {
                    const currentMinutes = customToMinutes(durationValue, durationUnit);
                    setDurationUnit("hour");
                    setDurationValue(String(Math.max(1, Math.round(currentMinutes / 60))));
                  }}
                >
                  <Text style={[styles.unitToggleText, durationUnit === "hour" && styles.unitToggleTextActive]}>hour</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[styles.submit, (busy || !title.trim()) && styles.disabled]}
              disabled={busy || !title.trim()}
              onPress={handleSubmit}
            >
              <AppIcon name={mode === "edit" ? "save" : "plus"} size={18} color="#fff" />
              <Text style={styles.submitText}>{busy ? "Saving..." : mode === "edit" ? "Save Habit" : "Add Habit"}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  popup: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xl,
    color: colors.text,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
  },
  label: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconRow: {
    gap: spacing.sm,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconChipActive: {
    borderColor: colors.habitBadge,
    backgroundColor: colors.habitBadgeLight,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  chipText: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textAlign: "center",
  },
  chipTextActive: {
    color: colors.accent,
  },
  intervalRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  intervalInput: {
    width: 80,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontWeight: "700",
  },
  intervalHint: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  dayChip: {
    width: "13.5%",
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  dayChipActive: {
    borderColor: colors.habitBadge,
    backgroundColor: colors.habitBadgeLight,
  },
  dayChipText: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: colors.habitBadge,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  pickerText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  customDurationRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  customDurationInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  unitToggleTrack: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    flexDirection: "row",
    overflow: "hidden",
  },
  unitToggleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unitToggleOptionActive: {
    backgroundColor: colors.accentLight,
  },
  unitToggleText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  unitToggleTextActive: {
    color: colors.accent,
  },
  submit: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: 14,
    backgroundColor: colors.accent,
  },
  submitText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
