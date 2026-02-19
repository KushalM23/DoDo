import React, { useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import type { Task } from "../types/task";
import { colors, spacing, radii, fontSize } from "../theme/colors";

type TaskItemProps = {
  task: Task;
  isHabit?: boolean;
  onToggle: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSwipeLeft: (task: Task) => void;
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

export function TaskItem({ task, isHabit, onToggle, onDelete, onSwipeLeft }: TaskItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.5),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          // Swipe LEFT → start / complete
          Animated.timing(translateX, { toValue: -300, duration: 200, useNativeDriver: true }).start(() => {
            onSwipeLeft(task);
            translateX.setValue(0);
          });
        } else if (gs.dx > SWIPE_THRESHOLD) {
          // Swipe RIGHT → delete
          Animated.timing(translateX, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
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
      {/* Background actions: left = delete (shown when swiping right), right = start (shown when swiping left) */}
      <View style={styles.actionsRow}>
        <View style={[styles.actionBg, styles.deleteActionBg]}>
          <Icon name="trash-2" size={16} color="#fff" />
          <Text style={styles.actionLabel}>Delete</Text>
        </View>
        <View style={[styles.actionBg, styles.startActionBg]}>
          <Icon name={timerActive ? "check" : "play"} size={16} color="#fff" />
          <Text style={styles.actionLabel}>{timerActive ? "Done" : "Start"}</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.card, task.completed && styles.completedCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Checkbox */}
        <Pressable style={styles.checkbox} onPress={() => onToggle(task)}>
          <View style={[styles.checkboxInner, task.completed && styles.checkboxChecked]}>
            {task.completed && <Icon name="check" size={14} color="#fff" />}
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
                <Icon name="play" size={10} color={colors.success} />
              </View>
            )}
            {isHabit && (
              <View style={styles.habitBadge}>
                <Icon name="repeat" size={10} color={colors.habitBadge} />
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Icon name="clock" size={11} color={colors.mutedText} />
            <Text style={styles.meta}>{formatTime(task.scheduledAt)}</Text>
            {task.durationMinutes != null && (
              <>
                <Text style={styles.metaDot}> · </Text>
                <Text style={styles.meta}>{task.durationMinutes}m</Text>
              </>
            )}
          </View>
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
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderRadius: radii.md,
  },
  actionsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radii.md,
  },
  actionBg: {
    width: 100,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.xs,
  },
  deleteActionBg: {
    backgroundColor: colors.danger,
  },
  startActionBg: {
    backgroundColor: colors.success,
  },
  actionLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.xs,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
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
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: colors.mutedText,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.mutedText,
  },
  metaDot: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
  },
  timerBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  habitBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.habitBadgeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityPill: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  priorityText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});

