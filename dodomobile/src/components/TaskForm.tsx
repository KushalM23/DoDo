import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CreateTaskInput, Priority } from "../types/task";
import type { Category } from "../types/category";
import { colors } from "../theme/colors";

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
];

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

export function TaskForm({ visible, categories, defaultDate, defaultCategoryId, onCancel, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<"AM" | "PM">("PM");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setPriority(2);
      const now = new Date();
      const h = now.getHours();
      setHour(h % 12 || 12);
      setMinute(Math.floor(now.getMinutes() / 15) * 15);
      setAmpm(h >= 12 ? "PM" : "AM");
      setDurationMinutes(60);
      setCategoryId(defaultCategoryId);
    }
  }, [visible, defaultCategoryId]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      let h24 = hour % 12;
      if (ampm === "PM") h24 += 12;

      const scheduledAt = new Date(`${defaultDate}T${padTwo(h24)}:${padTwo(minute)}:00`);
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

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>New Task</Text>

          {/* Title */}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.mutedText}
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
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
                  style={[styles.priorityBtn, active && { backgroundColor: col + "25", borderColor: col }]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityBtnText, active && { color: col }]}>
                    {p === 1 ? "Low" : p === 2 ? "Medium" : "High"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Time picker */}
          <Text style={styles.label}>Time</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeControl}>
              <Pressable style={styles.timeArrow} onPress={() => setHour((h) => (h >= 12 ? 1 : h + 1))}>
                <Text style={styles.arrowText}>▲</Text>
              </Pressable>
              <Text style={styles.timeValue}>{padTwo(hour)}</Text>
              <Pressable style={styles.timeArrow} onPress={() => setHour((h) => (h <= 1 ? 12 : h - 1))}>
                <Text style={styles.arrowText}>▼</Text>
              </Pressable>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeControl}>
              <Pressable style={styles.timeArrow} onPress={() => setMinute((m) => (m >= 45 ? 0 : m + 15))}>
                <Text style={styles.arrowText}>▲</Text>
              </Pressable>
              <Text style={styles.timeValue}>{padTwo(minute)}</Text>
              <Pressable style={styles.timeArrow} onPress={() => setMinute((m) => (m <= 0 ? 45 : m - 15))}>
                <Text style={styles.arrowText}>▼</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.ampmBtn}
              onPress={() => setAmpm((v) => (v === "AM" ? "PM" : "AM"))}
            >
              <Text style={styles.ampmText}>{ampm}</Text>
            </Pressable>
          </View>

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
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.submitBtn, (busy || !title.trim()) && styles.disabled]}
            onPress={handleSubmit}
            disabled={busy || !title.trim()}
          >
            <Text style={styles.submitText}>{busy ? "Saving..." : "Add Task"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 100,
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 20,
  },
  label: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 8,
    marginTop: 18,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  priorityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  priorityBtnText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: 14,
  },
  // Time picker
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeControl: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  timeArrow: {
    padding: 6,
  },
  arrowText: {
    color: colors.accent,
    fontSize: 14,
  },
  timeValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },
  timeSep: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  ampmBtn: {
    backgroundColor: colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 8,
  },
  ampmText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 15,
  },
  // Duration
  durationRow: {
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
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
  },
  durationTextActive: {
    color: colors.accent,
  },
  // Category
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
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
  },
  catChipTextActive: {
    color: colors.accent,
  },
  // Actions
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.mutedText,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.accent,
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
