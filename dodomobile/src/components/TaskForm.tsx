import React, { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { AppIcon } from "./AppIcon";
import type { CreateTaskInput, Priority } from "../types/task";
import type { Category } from "../types/category";
import { colors, spacing, radii, fontSize } from "../theme/colors";

type TaskFormProps = {
  visible: boolean;
  categories: Category[];
  defaultDate: string; // YYYY-MM-DD
  defaultCategoryId: string | null;
  onCancel: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
};

const DURATION_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "4h", value: 240 },
  { label: "5h", value: 300 },
];

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateDisplay(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTimeDisplay(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${padTwo(m)} ${ampm}`;
}

function roundToNextInterval(date: Date, intervalMinutes: number): Date {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const remainder = minutes % intervalMinutes;
  const delta = remainder === 0 ? 0 : intervalMinutes - remainder;
  next.setMinutes(minutes + delta, 0, 0);
  return next;
}

export function TaskForm({ visible, categories, defaultDate, defaultCategoryId, onCancel, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setPriority(2);

      const [year, month, day] = defaultDate.split("-").map(Number);
      const dateIsValid = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
      const nextDate = dateIsValid ? new Date(year, month - 1, day) : new Date();
      const roundedTime = roundToNextInterval(new Date(), 5);
      nextDate.setHours(roundedTime.getHours(), roundedTime.getMinutes(), 0, 0);

      setScheduledAt(nextDate);
      setDurationMinutes(60);
      setCategoryId(defaultCategoryId);
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible, defaultCategoryId, defaultDate]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const deadline = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

      await onSubmit({
        title: title.trim(),
        description: "",
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

  function handleDateChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type !== "set" || !date) return;

    setScheduledAt((prev) => {
      const next = new Date(prev);
      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      return next;
    });
  }

  function handleTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (event.type !== "set" || !date) return;

    setScheduledAt((prev) => {
      const next = new Date(prev);
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      return next;
    });
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.popup} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.popupHeader}>
              <Text style={styles.heading}>New Task</Text>
              <Pressable onPress={onCancel} hitSlop={12}>
                <AppIcon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            {/* Title */}
            <TextInput
              style={styles.input}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.mutedText}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
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
                      name={p === 3 ? "alert-circle" : p === 2 ? "minus-circle" : "arrow-down-circle"}
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

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <Pressable
              style={styles.pickerBtn}
              onPress={() => {
                setShowTimePicker(false);
                setShowDatePicker((prev) => !prev);
              }}
            >
              <AppIcon name="calendar" size={16} color={colors.accent} />
              <Text style={styles.pickerBtnText}>{formatDateDisplay(scheduledAt)}</Text>
              <AppIcon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
              />
            )}

            {/* Time */}
            <Text style={styles.label}>Time</Text>
            <Pressable
              style={styles.pickerBtn}
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker((prev) => !prev);
              }}
            >
              <AppIcon name="clock" size={16} color={colors.accent} />
              <Text style={styles.pickerBtnText}>{formatTimeDisplay(scheduledAt)}</Text>
              <AppIcon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minuteInterval={Platform.OS === "ios" ? 5 : undefined}
                onChange={handleTimeChange}
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
                    onPress={() => setDurationMinutes(opt.value)}
                  >
                    <Text style={[styles.durationText, active && styles.durationTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

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
              <AppIcon name="plus" size={18} color="#fff" />
              <Text style={styles.submitText}>{busy ? "Saving..." : "Add Task"}</Text>
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
