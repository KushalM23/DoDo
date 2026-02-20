import React, { useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./AppIcon";
import type { Task } from "../types/task";
import type { Category } from "../types/category";
import { spacing, radii, fontSize } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";
import { usePreferences } from "../state/PreferencesContext";
import { formatTime } from "../utils/dateTime";

type TaskItemProps = {
  task: Task;
  category?: Category | null;
  isHabit?: boolean;
  onToggle: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSwipeLeft: (task: Task) => void;
  onPress?: (task: Task) => void;
};

function priorityColor(priority: number, colors: ThemeColors): string {
  if (priority === 3) return colors.highPriority;
  if (priority === 2) return colors.mediumPriority;
  return colors.lowPriority;
}

function getSwipeLeftIcon(task: Task): "play" | "check" {
  if (task.completed || task.timerStartedAt) return "check";
  return "play";
}

function priorityIcon(priority: number): "arrow-up-circle" | "minus-circle" | "arrow-down-circle" {
  if (priority === 3) return "arrow-up-circle";
  if (priority === 2) return "minus-circle";
  return "arrow-down-circle";
}

const SWIPE_THRESHOLD = 74;
const SWIPE_LIMIT = 108;

export function TaskItem({ task, category, isHabit, onToggle, onDelete, onSwipeLeft, onPress }: TaskItemProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preferences } = usePreferences();
  const translateX = useRef(new Animated.Value(0)).current;
  const timerActive = !!task.timerStartedAt && !task.completed;

  // Keep refs so the PanResponder always uses latest values
  const taskRef = useRef(task);
  taskRef.current = task;
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const swipeLeftIcon = getSwipeLeftIcon(task);
  const showLeadingIcon = isHabit || !!category;
  const leadingIcon = isHabit ? "repeat" : category?.icon;
  const leadingIconColor = isHabit ? colors.habitBadge : category?.color ?? colors.mutedText;

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
            onSwipeLeftRef.current(taskRef.current);
            translateX.setValue(0);
          });
          return;
        }

        if (gs.dx >= SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: SWIPE_LIMIT, duration: 140, useNativeDriver: true }).start(() => {
            onDeleteRef.current(taskRef.current.id);
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
        <Animated.View style={[styles.actionPane, styles.actionPaneLeft, styles.deleteActionBg, { opacity: leftActionOpacity }]}>
          <AppIcon name="trash-2" size={15} color="#fff" />
        </Animated.View>
        <Animated.View style={[styles.actionPane, styles.actionPaneRight, styles.completeActionBg, { opacity: rightActionOpacity }]}>
          <AppIcon name={swipeLeftIcon} size={15} color="#fff" />
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.card, task.completed && styles.completedCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.checkbox} onPress={() => onToggleRef.current(taskRef.current)}>
          <View style={[styles.checkboxInner, task.completed && styles.checkboxChecked]}>
            {task.completed && <AppIcon name="check" size={13} color="#fff" />}
          </View>
        </Pressable>

        {showLeadingIcon && leadingIcon ? (
          <View style={[styles.leadingIconPill, { backgroundColor: `${leadingIconColor}22` }]}>
            <AppIcon name={leadingIcon} size={17} color={leadingIconColor} />
          </View>
        ) : null}

        <Pressable style={styles.content} onPress={() => onPressRef.current?.(taskRef.current)}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, task.completed && styles.completedText]} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <AppIcon name="clock" size={11} color={colors.mutedText} />
            <Text style={styles.meta}>{formatTime(task.scheduledAt, preferences.timeFormat)}</Text>
            {task.durationMinutes != null && (
              <>
                <Text style={styles.metaDot}> · </Text>
                <Text style={styles.meta}>{task.durationMinutes}m</Text>
              </>
            )}
          </View>
        </Pressable>

        <View style={styles.badgesCol}>
          <View style={styles.badgeTopRow}>
            <View style={[styles.priorityPill, { backgroundColor: `${priorityColor(task.priority, colors)}22` }]}> 
              <AppIcon name={priorityIcon(task.priority)} size={13} color={priorityColor(task.priority, colors)} />
            </View>
          </View>
          <View style={styles.badgeBottomRow}>
            {timerActive && (
              <View style={styles.timerBadge}>
                <AppIcon name="play" size={10} color={colors.success} />
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  },
  actionPaneLeft: {
    alignItems: "flex-start",
    paddingLeft: spacing.lg,
  },
  actionPaneRight: {
    alignItems: "flex-end",
    paddingRight: spacing.lg,
  },
  deleteActionBg: {
    backgroundColor: colors.danger,
  },
  completeActionBg: {
    backgroundColor: colors.success,
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
  leadingIconPill: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
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
  priorityPill: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesCol: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  badgeTopRow: {
    flexDirection: "row",
    gap: 6,
  },
  badgeBottomRow: {
    minHeight: 20,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
