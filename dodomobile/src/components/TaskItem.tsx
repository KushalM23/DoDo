import React, { useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./AppIcon";
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

const SWIPE_THRESHOLD = 74;
const SWIPE_LIMIT = 108;

export function TaskItem({ task, isHabit, onToggle, onDelete, onSwipeLeft }: TaskItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const timerActive = !!task.timerStartedAt && !task.completed;

  const rightActionOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-SWIPE_LIMIT, -20, 0],
        outputRange: [1, 0.2, 0],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  const leftActionOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, 20, SWIPE_LIMIT],
        outputRange: [0, 0.2, 1],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.3),
      onPanResponderMove: (_, gs) => {
        const clampedDx = Math.max(-SWIPE_LIMIT, Math.min(SWIPE_LIMIT, gs.dx));
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx <= -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SWIPE_LIMIT, duration: 140, useNativeDriver: true }).start(() => {
            onSwipeLeft(task);
            translateX.setValue(0);
          });
          return;
        }

        if (gs.dx >= SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: SWIPE_LIMIT, duration: 140, useNativeDriver: true }).start(() => {
            onDelete(task.id);
            translateX.setValue(0);
          });
          return;
        }

        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.outer}>
      <View style={styles.actionsRow}>
        <Animated.View style={[styles.actionPane, styles.deleteActionBg, { opacity: leftActionOpacity }]}>
          <AppIcon name="trash-2" size={15} color="#fff" />
          <Text style={styles.actionLabel}>Delete</Text>
        </Animated.View>
        <Animated.View style={[styles.actionPane, styles.completeActionBg, { opacity: rightActionOpacity }]}>
          <AppIcon name="check" size={15} color="#fff" />
          <Text style={styles.actionLabel}>{task.completed ? "Undo" : "Complete"}</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.card, task.completed && styles.completedCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.checkbox} onPress={() => onToggle(task)}>
          <View style={[styles.checkboxInner, task.completed && styles.checkboxChecked]}>
            {task.completed && <AppIcon name="check" size={13} color="#fff" />}
          </View>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, task.completed && styles.completedText]} numberOfLines={1}>
              {task.title}
            </Text>
            {timerActive && (
              <View style={styles.timerBadge}>
                <AppIcon name="play" size={10} color={colors.success} />
              </View>
            )}
            {isHabit && (
              <View style={styles.habitBadge}>
                <AppIcon name="repeat" size={10} color={colors.habitBadge} />
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="clock" size={11} color={colors.mutedText} />
            <Text style={styles.meta}>{formatTime(task.scheduledAt)}</Text>
            {task.durationMinutes != null && (
              <>
                <Text style={styles.metaDot}> · </Text>
                <Text style={styles.meta}>{task.durationMinutes}m</Text>
              </>
            )}
          </View>
        </View>

        <View style={[styles.priorityPill, { backgroundColor: `${priorityColor(task.priority)}22` }]}>
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
    borderRadius: radii.md,
    overflow: "hidden",
  },
  actionPane: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  deleteActionBg: {
    backgroundColor: colors.danger,
  },
  completeActionBg: {
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
    gap: spacing.sm,
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
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  habitBadge: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
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
