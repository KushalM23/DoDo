import React, { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import type { Task } from "../types/task";
import { colors } from "../theme/colors";

type TaskItemProps = {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSwipeRight: (task: Task) => void;
};

function priorityColor(priority: number): string {
  if (priority === 3) return colors.highPriority;
  if (priority === 2) return colors.mediumPriority;
  return colors.lowPriority;
}

function priorityLabel(priority: number): string {
  if (priority === 3) return "High";
  if (priority === 2) return "Med";
  return "Low";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const SWIPE_THRESHOLD = 80;

export function TaskItem({ task, onToggle, onDelete, onSwipeRight }: TaskItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.5),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
            onSwipeRight(task);
            translateX.setValue(0);
          });
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -300, duration: 200, useNativeDriver: true }).start(() => {
            onDelete(task.id);
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    }),
  ).current;

  const timerActive = !!task.timerStartedAt && !task.completed;

  return (
    <View style={styles.outer}>
      {/* Background actions */}
      <View style={styles.actionsRow}>
        <View style={[styles.actionBg, styles.rightActionBg]}>
          <Text style={styles.actionLabel}>
            {timerActive ? "✓ Done" : "▶ Start"}
          </Text>
        </View>
        <View style={[styles.actionBg, styles.leftActionBg]}>
          <Text style={styles.actionLabel}>✕ Delete</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.card, task.completed && styles.completedCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Checkbox */}
        <Pressable style={styles.checkbox} onPress={() => onToggle(task)}>
          <View style={[styles.checkboxInner, task.completed && styles.checkboxChecked]}>
            {task.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, task.completed && styles.completedText]} numberOfLines={1}>
              {task.title}
            </Text>
            {timerActive && (
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>▶</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>{formatTime(task.scheduledAt)}</Text>
        </View>

        {/* Priority pill */}
        <View style={[styles.priorityPill, { backgroundColor: priorityColor(task.priority) + "20" }]}>
          <Text style={[styles.priorityText, { color: priorityColor(task.priority) }]}>
            {priorityLabel(task.priority)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: 14,
  },
  actionsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
  },
  actionBg: {
    width: 100,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  rightActionBg: {
    backgroundColor: colors.success,
  },
  leftActionBg: {
    backgroundColor: colors.danger,
  },
  actionLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  completedCard: {
    opacity: 0.55,
  },
  checkbox: {
    padding: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.mutedText,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: -1,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: colors.mutedText,
  },
  meta: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  timerBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    color: colors.success,
    fontSize: 10,
  },
  priorityPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

