import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CustomDateTimePicker } from "./CustomDateTimePicker";
import { AppIcon } from "./AppIcon";
import type { CreateTaskInput, Priority } from "../types/task";
import type { Category } from "../types/category";
import { colors, spacing, radii, fontSize } from "../theme/colors";
import { usePreferences } from "../state/PreferencesContext";
import { formatDate, formatTime } from "../utils/dateTime";

type TaskFormProps = {
  visible: boolean;
  categories: Category[];
  defaultDate: string; // YYYY-MM-DD
  defaultCategoryId: string | null;
  mode?: "create" | "edit";
  initialValues?: Partial<CreateTaskInput>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
};

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

function roundToNextInterval(date: Date, intervalMinutes: number): Date {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const remainder = minutes % intervalMinutes;
  const delta = remainder === 0 ? 0 : intervalMinutes - remainder;
  next.setMinutes(minutes + delta, 0, 0);
  return next;
}

export function TaskForm({
  visible,
  categories,
  defaultDate,
  defaultCategoryId,
  mode = "create",
  initialValues,
  submitLabel,
  onCancel,
  onSubmit,
}: TaskFormProps) {
  const { preferences } = usePreferences();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [durationCustom, setDurationCustom] = useState("45");
  const [durationUnit, setDurationUnit] = useState<"min" | "hour">("min");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const editing = mode === "edit" && !!initialValues;
      const initialDate = editing && initialValues?.scheduledAt ? new Date(initialValues.scheduledAt) : null;

      if (editing) {
        setTitle(initialValues?.title ?? "");
        setDescription(initialValues?.description ?? "");
        setPriority((initialValues?.priority as Priority | undefined) ?? 2);
        setScheduledAt(initialDate && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date());
        const nextDuration = initialValues?.durationMinutes ?? 60;
        setDurationMinutes(nextDuration);
        setDurationCustom(String(nextDuration));
        setDurationUnit("min");
        setCategoryId(initialValues?.categoryId ?? null);
      } else {
        setTitle("");
        setDescription("");
        setPriority(2);

        const [year, month, day] = defaultDate.split("-").map(Number);
        const dateIsValid = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
        const nextDate = dateIsValid ? new Date(year, month - 1, day) : new Date();
        const roundedTime = roundToNextInterval(new Date(), 5);
        nextDate.setHours(roundedTime.getHours(), roundedTime.getMinutes(), 0, 0);

        setScheduledAt(nextDate);
        setDurationMinutes(45);
        setDurationCustom("45");
        setDurationUnit("min");
        setCategoryId(defaultCategoryId);
      }

      setShowPicker(false);
    }
  }, [visible, defaultCategoryId, defaultDate, initialValues, mode]);

  async function handleSubmit() {
    if (!title.trim()) return;
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      Alert.alert("Invalid duration", "Duration must be at least 1 minute.");
      return;
    }
    setBusy(true);
    try {
      const deadline = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        scheduledAt: scheduledAt.toISOString(),
        deadline: deadline.toISOString(),
        durationMinutes,
        priority,
      });
      onCancel();
    } catch (err) {
      Alert.alert("Failed to create task", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function customToMinutes(raw: string, unit: "min" | "hour") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return durationMinutes;
    const base = unit === "hour" ? parsed * 60 : parsed;
    return Math.max(1, Math.min(1440, Math.trunc(base)));
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.popup} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.popupHeader}>
              <Text style={styles.heading}>{mode === "edit" ? "Edit Task" : "New Task"}</Text>
              <Pressable onPress={onCancel} hitSlop={12}>
                <AppIcon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            {/* Title */}
            <TextInput
              style={styles.input}
              placeholder="Dodo's task"
              placeholderTextColor={colors.mutedText}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
            />

            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Add notes (optional)"
              placeholderTextColor={colors.mutedText}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            {/* Priority */}
            <Text style={styles.label}>Priority</Text>
            <View style={styles.row}>
              {([1, 2, 3] as Priority[]).map((p) => {
                const active = priority === p;
                const col = p === 3 ? colors.highPriority : p === 2 ? colors.mediumPriority : colors.lowPriority;
                return (
                  <Pressable
                    key={p}
                    style={[styles.chipBtn, active && { backgroundColor: col + "25", borderColor: col }]}
                    onPress={() => setPriority(p)}
                  >
                    <AppIcon
                      name={p === 3 ? "arrow-up-circle" : p === 2 ? "minus-circle" : "arrow-down-circle"}
                      size={14}
                      color={active ? col : colors.mutedText}
                    />
                    <Text style={[styles.chipBtnText, active && { color: col }]}>
                      {p === 1 ? "Low" : p === 2 ? "Medium" : "High"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date & Time */}
            <Text style={styles.label}>Date & Time</Text>
            <Pressable
              style={styles.pickerBtn}
              onPress={() => setShowPicker((prev) => !prev)}
            >
              <AppIcon name="calendar" size={16} color={colors.accent} />
              <Text style={styles.pickerBtnText}>
                {formatDate(scheduledAt, preferences.dateFormat)}, {formatTime(scheduledAt, preferences.timeFormat)}
              </Text>
              <AppIcon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showPicker && (
              <CustomDateTimePicker
                value={scheduledAt}
                onChange={setScheduledAt}
                timeFormat={preferences.timeFormat}
                weekStart={preferences.weekStart}
              />
            )}

            {/* Duration */}
            <Text style={styles.label}>Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = durationMinutes === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.durationChip, active && styles.durationChipActive]}
                    onPress={() => {
                      setDurationMinutes(opt.value);
                      setDurationCustom(String(opt.value));
                      setDurationUnit("min");
                    }}
                  >
                    <Text style={[styles.durationText, active && styles.durationTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.customDurationRow}>
              <TextInput
                style={styles.customDurationInput}
                value={durationCustom}
                onChangeText={(raw) => {
                  const clean = raw.replace(/[^0-9]/g, "").slice(0, 4);
                  setDurationCustom(clean);
                  if (clean.length === 0) return;
                  setDurationMinutes(customToMinutes(clean, durationUnit));
                }}
                onBlur={() => {
                  const normalized = customToMinutes(durationCustom, durationUnit);
                  setDurationMinutes(normalized);
                  const display = durationUnit === "hour" ? Math.max(1, Math.round(normalized / 60)) : normalized;
                  setDurationCustom(String(display));
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="Custom duration"
                placeholderTextColor={colors.mutedText}
              />
              <View style={styles.unitToggleTrack}>
                <Pressable
                  style={[styles.unitToggleOption, durationUnit === "min" && styles.unitToggleOptionActive]}
                  onPress={() => {
                    setDurationUnit("min");
                    setDurationCustom(String(durationMinutes));
                  }}
                >
                  <Text style={[styles.unitToggleText, durationUnit === "min" && styles.unitToggleTextActive]}>min</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitToggleOption, durationUnit === "hour" && styles.unitToggleOptionActive]}
                  onPress={() => {
                    setDurationUnit("hour");
                    setDurationCustom(String(Math.max(1, Math.round(durationMinutes / 60))));
                  }}
                >
                  <Text style={[styles.unitToggleText, durationUnit === "hour" && styles.unitToggleTextActive]}>hour</Text>
                </Pressable>
              </View>
            </View>

            {/* Category */}
            {categories.length > 0 && (
              <>
                <Text style={styles.label}>Category</Text>
                <View style={styles.row}>
                  {categories.map((cat) => {
                    const active = categoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.catChip, active && styles.catChipActive]}
                        onPress={() => setCategoryId(active ? null : cat.id)}
                      >
                        <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Submit */}
            <Pressable
              style={[styles.submitBtn, (busy || !title.trim()) && styles.disabled]}
              onPress={handleSubmit}
              disabled={busy || !title.trim()}
            >
              <AppIcon name={mode === "edit" ? "save" : "plus"} size={18} color="#fff" />
              <Text style={styles.submitText}>{busy ? "Saving..." : submitLabel ?? (mode === "edit" ? "Save Changes" : "Add Task")}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  popupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
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
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 90,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  chipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surfaceLight,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  chipBtnText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.sm,
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
  pickerBtnText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
    flex: 1,
  },
  durationRow: {
    gap: spacing.sm,
  },
  customDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  customDurationInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
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
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  durationText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  durationTextActive: {
    color: colors.accent,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  catChipText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  catChipTextActive: {
    color: colors.accent,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: 14,
    backgroundColor: colors.accent,
    marginTop: spacing.xl,
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
  },
  disabled: {
    opacity: 0.5,
  },
});
