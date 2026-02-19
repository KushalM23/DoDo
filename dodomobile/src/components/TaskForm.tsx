import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/Feather";
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

export function TaskForm({ visible, categories, defaultDate, defaultCategoryId, onCancel, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setPriority(2);
      const dateParts = defaultDate.split("-").map(Number);
      const now = new Date();
      const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      setSelectedDate(d);
      // Round current time to nearest 15 min
      const roundedMin = Math.ceil(now.getMinutes() / 15) * 15;
      const timeDate = new Date(now);
      timeDate.setMinutes(roundedMin, 0, 0);
      setSelectedTime(timeDate);
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
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const y = selectedDate.getFullYear();
      const mo = selectedDate.getMonth();
      const day = selectedDate.getDate();

      const scheduledAt = new Date(y, mo, day, h, m, 0);
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
    } finally {
      setBusy(false);
    }
  }

  function handleDateChange(_: any, date?: Date) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  function handleTimeChange(_: any, date?: Date) {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (date) setSelectedTime(date);
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
                <Icon name="x" size={22} color={colors.mutedText} />
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
                    <Icon
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
            <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Icon name="calendar" size={16} color={colors.accent} />
              <Text style={styles.pickerBtnText}>{formatDateDisplay(selectedDate)}</Text>
              <Icon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={handleDateChange}
                themeVariant="dark"
              />
            )}

            {/* Time */}
            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
              <Icon name="clock" size={16} color={colors.accent} />
              <Text style={styles.pickerBtnText}>{formatTimeDisplay(selectedTime)}</Text>
              <Icon name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minuteInterval={5}
                onChange={handleTimeChange}
                themeVariant="dark"
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
              <Icon name="plus" size={18} color="#fff" />
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
