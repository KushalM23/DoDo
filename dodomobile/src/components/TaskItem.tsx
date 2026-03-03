import React, { useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./AppIcon";
import type { Task } from "../types/task";
import type { Category } from "../types/category";
import type { HabitIcon } from "../types/habit";
import { spacing, radii, fontSize } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";
import { usePreferences } from "../state/PreferencesContext";
import { formatTime } from "../utils/dateTime";

type TaskItemProps = {
  task: Task;
  category?: Category | null;
  isHabit?: boolean;
  habitIcon?: HabitIcon;
  onToggle: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onSwipeLeft: (task: Task) => void;
  onPress?: (task: Task) => void;
  onLongPress?: (task: Task) => void;
  selected?: boolean;
  selectionMode?: boolean;
};

function priorityColor(priority: number, colors: ThemeColors): string {
  if (priority === 3) return colors.highPriority;
  if (priority === 2) return colors.mediumPriority;
  return colors.lowPriority;
}

function priorityIcon(priority: number): "arrow-up-circle" | "minus-circle" | "arrow-down-circle" {
  if (priority === 3) return "arrow-up-circle";
  if (priority === 2) return "minus-circle";
  return "arrow-down-circle";
}

const SWIPE_THRESHOLD = 74;
const SWIPE_LIMIT = 108;

export function TaskItem({
  task,
  category,
  isHabit,
  habitIcon,
  onToggle,
  onDelete,
  onSwipeLeft,
  onPress,
  onLongPress,
  selected,
  selectionMode,
}: TaskItemProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preferences } = usePreferences();
  const translateX = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

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
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  const showLeadingIcon = isHabit || !!category;
  const leadingIcon = isHabit ? (habitIcon ?? "target") : category?.icon;
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
        !selectionModeRef.current && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.3),
      onPanResponderMove: (_, gs) => {
        if (selectionModeRef.current) return;
        const clampedDx = Math.max(-SWIPE_LIMIT, Math.min(SWIPE_LIMIT, gs.dx));
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gs) => {
        if (selectionModeRef.current) return;
        if (gs.dx <= -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SWIPE_LIMIT, duration: 120, useNativeDriver: true }).start(() => {
            onSwipeLeftRef.current(taskRef.current);
            translateX.setValue(0);
          });
          return;
        }

        if (gs.dx >= SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: SWIPE_LIMIT, duration: 120, useNativeDriver: true }).start(() => {
            onDeleteRef.current(taskRef.current.id);
            translateX.setValue(0);
          });
          return;
        }

        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      },
    }),
  ).current;

  function handlePressIn() {
    Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 40 }).start();
  }

  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }

  const priorityPillColor = isHabit
    ? `${colors.habitBadge}20`
    : `${priorityColor(task.priority, colors)}20`;
  const priorityIconColor = isHabit ? colors.habitBadge : priorityColor(task.priority, colors);

  return (
    <View style={styles.outer}>
      {!selectionMode && (
        <View style={styles.actionsRow}>
          <Animated.View style={[styles.actionPane, styles.actionPaneLeft, styles.deleteActionBg, { opacity: leftActionOpacity }]}>
            <AppIcon name="trash-2" size={16} color="#fff" />
            <Text style={styles.actionLabel}>Delete</Text>
          </Animated.View>
          <Animated.View style={[styles.actionPane, styles.actionPaneRight, styles.completeActionBg, { opacity: rightActionOpacity }]}>
            <AppIcon name="check" size={16} color="#fff" />
            <Text style={styles.actionLabel}>Done</Text>
          </Animated.View>
        </View>
      )}

      <Animated.View
        style={[
          styles.card,
          task.completed && styles.completedCard,
          selected && styles.selectedCard,
          { transform: [{ translateX: selectionMode ? 0 : translateX }, { scale: pressScale }] },
        ]}
        {...(selectionMode ? {} : panResponder.panHandlers)}
      >
        {/* Checkbox */}
        {selectionMode ? (
          <Pressable
            style={styles.checkboxWrap}
            onPress={() => onPressRef.current?.(taskRef.current)}
            onLongPress={() => onLongPressRef.current?.(taskRef.current)}
          >
            <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
              {selected && <AppIcon name="check" size={11} color="#fff" />}
            </View>
          </Pressable>
        ) : (
          <Pressable style={styles.checkboxWrap} onPress={() => onToggleRef.current(taskRef.current)}>
            <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
              {task.completed && <AppIcon name="check" size={11} color="#fff" />}
            </View>
          </Pressable>
        )}

        {/* Leading icon pill */}
        {showLeadingIcon && leadingIcon ? (
          <View style={[styles.leadingIconPill, { backgroundColor: `${leadingIconColor}18` }]}>
            <AppIcon name={leadingIcon} size={15} color={leadingIconColor} />
          </View>
        ) : null}

        {/* Content */}
        <Pressable
          style={styles.content}
          onPress={() => onPressRef.current?.(taskRef.current)}
          onLongPress={() => onLongPressRef.current?.(taskRef.current)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={400}
        >
          <Text style={[styles.title, task.completed && styles.completedText]} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={styles.metaRow}>
            <AppIcon name="clock" size={10} color={colors.mutedText} />
            <Text style={styles.meta}>{formatTime(task.scheduledAt, preferences.timeFormat)}</Text>
            {task.durationMinutes != null && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.meta}>{task.durationMinutes}m</Text>
              </>
            )}
          </View>
        </Pressable>

        {/* Priority badge */}
        <View style={[styles.priorityPill, { backgroundColor: priorityPillColor }]}>
          <AppIcon
            name={isHabit ? "repeat" : priorityIcon(task.priority)}
            size={12}
            color={priorityIconColor}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outer: {
      marginBottom: spacing.xs,
      overflow: "hidden",
      borderRadius: radii.lg,
    },
    actionsRow: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      borderRadius: radii.lg,
      overflow: "hidden",
    },
    actionPane: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    actionPaneLeft: {
      alignItems: "flex-start",
      paddingLeft: spacing.sm,
    },
    actionPaneRight: {
      alignItems: "flex-end",
      paddingRight: spacing.sm,
    },
    actionLabel: {
      color: "#fff",
      fontSize: fontSize.xs,
      fontWeight: "700",
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
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm - 2,
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
      elevation: 2,
    },
    completedCard: {
      opacity: 0.45,
    },
    selectedCard: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
      shadowColor: colors.accent,
    },
    checkboxWrap: {
      padding: 4,
    },
    leadingIconPill: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.borderStrong,
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
    title: {
      fontSize: fontSize.md,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: -0.2,
    },
    completedText: {
      textDecorationLine: "line-through",
      color: colors.mutedText,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    meta: {
      fontSize: fontSize.xs,
      color: colors.mutedText,
      fontWeight: "500",
    },
    metaDot: {
      color: colors.mutedText,
      fontSize: fontSize.xs,
    },
    priorityPill: {
      width: 28,
      height: 28,
      borderRadius: radii.sm,
      alignItems: "center",
      justifyContent: "center",
    },
  });
