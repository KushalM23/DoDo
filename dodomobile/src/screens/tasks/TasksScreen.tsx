import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { useCategories } from "../../state/CategoriesContext";
import { TaskForm } from "../../components/TaskForm";
import { TaskItem } from "../../components/TaskItem";
import { CategoryBar } from "../../components/CategoryBar";
import { DateStrip } from "../../components/DateStrip";
import { SortModal } from "../../components/SortModal";
import { AppIcon } from "../../components/AppIcon";
import { LoadingScreen } from "../../components/LoadingScreen";
import { sortTasks } from "../../utils/taskSort";
import { habitAppliesToDate, minuteToIso } from "../../utils/habits";
import { spacing, radii, fontSize } from "../../theme/colors";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";
import type { CreateTaskInput, Task } from "../../types/task";
import type { Habit } from "../../types/habit";
import type { RootStackParamList } from "../../navigation/RootNavigator";

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDateStr(isoString: string): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(isoString: string, dateStr: string): boolean {
  return toLocalDateStr(isoString) === dateStr;
}

/** Convert a habit into a Task-shaped object for display */
function habitToTask(habit: Habit, dateStr: string, completed: boolean): Task & { _isHabit: true; _habitId: string } {
  const minute = habit.timeMinute ?? 9 * 60;
  const durationMinutes = habit.durationMinutes ?? 30;
  const scheduledAt = minuteToIso(dateStr, minute);
  return {
    id: `habit_${habit.id}_${dateStr}`,
    _isHabit: true,
    _habitId: habit.id,
    title: habit.title,
    description: "",
    categoryId: null,
    scheduledAt,
    deadline: minuteToIso(dateStr, Math.min(1439, minute + durationMinutes)),
    durationMinutes,
    priority: 2,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    timerStartedAt: completed ? null : habit.timerStartedAt,
    actualDurationMinutes: Math.max(0, Math.round((habit.trackedSecondsToday ?? 0) / 60)),
    completionXp: 0,
    createdAt: habit.createdAt,
  };
}

type DisplayTask = Task & { _isHabit?: boolean; _habitId?: string };
type UndoState =
  | { kind: "complete"; task: Task; message: string }
  | { kind: "habit-complete"; habitId: string; date: string; message: string }
  | { kind: "delete"; task: Task; message: string };

export function TasksScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tasks, loading, initialized: tasksInitialized, error, sortMode, setSortMode, refresh, addTask, removeTask, toggleTaskCompletion, startTimer } = useTasks();
  const {
    habits,
    loading: habitsLoading,
    initialized: habitsInitialized,
    loadHistory,
    isHabitCompletedOn,
    setHabitCompletedOn,
    startHabitTimer,
  } = useHabits();
  const { categories, loading: categoriesLoading, initialized: categoriesInitialized } = useCategories();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [undoProgress, setUndoProgress] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTodaySelected = selectedDate === todayStr();
  const screenBootLoading =
    !tasksInitialized ||
    !habitsInitialized ||
    !categoriesInitialized ||
    (loading && tasks.length === 0) ||
    (habitsLoading && habits.length === 0) ||
    (categoriesLoading && categories.length === 0);

  useEffect(() => {
    void loadHistory({ startDate: selectedDate, endDate: selectedDate }).catch(() => {});
  }, [selectedDate, loadHistory]);

  // Filter tasks and merge habits
  const filteredTasks = useMemo(() => {
    // Regular tasks
    const dateTasks = tasks.filter((t) => {
      if (t.completed) return false;
      if (pendingDeleteId === t.id) return false;
      const dateMatch = isSameDay(t.scheduledAt, selectedDate);
      if (!dateMatch) return false;
      if (selectedCategory === null) return true;
      return t.categoryId === selectedCategory;
    });

    // Habit-derived tasks (only in Overview / no category filter)
    const habitTasks: DisplayTask[] = selectedCategory === null && isTodaySelected
      ? habits
          .filter((h) => habitAppliesToDate(h, selectedDate))
          .reduce<DisplayTask[]>((acc, h) => {
            const next = habitToTask(h, selectedDate, isHabitCompletedOn(h.id, selectedDate));
            if (!next.completed) acc.push(next);
            return acc;
          }, [])
      : [];

    return sortTasks([...dateTasks, ...habitTasks], sortMode);
  }, [tasks, habits, selectedDate, selectedCategory, isHabitCompletedOn, sortMode, isTodaySelected]);

  const archivedTasks = useMemo(() => {
    return [...tasks]
      .filter((t) => t.completed)
      .filter((t) => t.id !== pendingDeleteId)
      .filter((t) => isSameDay(t.scheduledAt, selectedDate))
      .filter((t) => (selectedCategory ? t.categoryId === selectedCategory : true))
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [tasks, selectedCategory, pendingDeleteId, selectedDate]);

  const listData = archiveMode ? archivedTasks : filteredTasks;
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const handleRefresh = useCallback(() => {
    void refresh(selectedDate);
  }, [refresh, selectedDate]);

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      void refresh(date);
    },
    [refresh],
  );

  async function handleCreateTask(input: CreateTaskInput) {
    await addTask(input);
  }

  function scheduleUndo(nextUndo: UndoState) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (undoState?.kind === "delete" && pendingDeleteId === undoState.task.id) {
      void removeTask(undoState.task.id).catch((err) => {
        Alert.alert("Failed to delete task", err instanceof Error ? err.message : "Unknown error");
      });
      setPendingDeleteId(null);
    }

    setUndoState(nextUndo);
    setUndoProgress(1);

    const startTime = Date.now();
    if (undoProgressTimerRef.current) {
      clearInterval(undoProgressTimerRef.current);
      undoProgressTimerRef.current = null;
    }
    undoProgressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / 3000);
      setUndoProgress(remaining);
      if (remaining <= 0 && undoProgressTimerRef.current) {
        clearInterval(undoProgressTimerRef.current);
        undoProgressTimerRef.current = null;
      }
    }, 50);

    undoTimerRef.current = setTimeout(() => {
      if (nextUndo.kind === "delete") {
        void removeTask(nextUndo.task.id).catch((err) => {
          Alert.alert("Failed to delete task", err instanceof Error ? err.message : "Unknown error");
        });
        setPendingDeleteId(null);
      }
      setUndoState(null);
      setUndoProgress(0);
      undoTimerRef.current = null;
    }, 3000);
  }

  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoProgressTimerRef.current) {
      clearInterval(undoProgressTimerRef.current);
      undoProgressTimerRef.current = null;
    }

    if (undoState.kind === "complete") {
      void toggleTaskCompletion(undoState.task);
    }

    if (undoState.kind === "habit-complete") {
      void setHabitCompletedOn(undoState.habitId, undoState.date, false).catch((err) => {
        Alert.alert("Failed to undo habit", err instanceof Error ? err.message : "Unknown error");
      });
    }

    if (undoState.kind === "delete") {
      setPendingDeleteId(null);
    }

    setUndoState(null);
    setUndoProgress(0);
  }

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoProgressTimerRef.current) clearInterval(undoProgressTimerRef.current);
    };
  }, []);

  function handleDeleteTask(taskId: string) {
    if (taskId.startsWith("habit_")) {
      Alert.alert("Manage habits in Habits tab", "Delete habits from the Habits screen.");
      return;
    }

    const taskToDelete = tasks.find((t) => t.id === taskId);
    if (!taskToDelete) return;

    setPendingDeleteId(taskId);
    scheduleUndo({ kind: "delete", task: taskToDelete, message: "Task deleted" });
  }

  function handleToggleTask(task: DisplayTask) {
    if (task._isHabit) {
      if (!isTodaySelected) {
        Alert.alert("Habits are only for today", "You can complete habits only on the current date.");
        return;
      }
      const nextCompleted = !task.completed;
      const habitId = task._habitId!;
      void setHabitCompletedOn(habitId, selectedDate, nextCompleted).catch((err) => {
        Alert.alert("Failed to update habit", err instanceof Error ? err.message : "Unknown error");
      });

      if (nextCompleted) {
        scheduleUndo({
          kind: "habit-complete",
          habitId,
          date: selectedDate,
          message: "Habit completed",
        });
      }
      return;
    }
    void toggleTaskCompletion(task).catch((err) => {
      Alert.alert("Failed to update task", err instanceof Error ? err.message : "Unknown error");
    });

    if (!task.completed) {
      scheduleUndo({
        kind: "complete",
        task: {
          ...task,
          completed: true,
          completedAt: new Date().toISOString(),
        },
        message: "Task completed",
      });
    }
  }

  function handleSwipeLeft(task: DisplayTask) {
    if (task._isHabit) {
      if (!isTodaySelected) {
        Alert.alert("Habits are only for today", "You can complete habits only on the current date.");
        return;
      }
      const habitId = task._habitId!;

      if (task.completed) {
        void setHabitCompletedOn(habitId, selectedDate, false).catch((err) => {
          Alert.alert("Failed to update habit", err instanceof Error ? err.message : "Unknown error");
        });
        return;
      }

      if (task.timerStartedAt) {
        void setHabitCompletedOn(habitId, selectedDate, true).catch((err) => {
          Alert.alert("Failed to update habit", err instanceof Error ? err.message : "Unknown error");
        });
        scheduleUndo({
          kind: "habit-complete",
          habitId,
          date: selectedDate,
          message: "Habit completed",
        });
        return;
      }

      void startHabitTimer(habitId, selectedDate).catch((err) => {
        Alert.alert("Failed to start habit", err instanceof Error ? err.message : "Unknown error");
      });
      return;
    }

    if (task.completed) {
      void toggleTaskCompletion(task);
    } else if (task.timerStartedAt) {
      void toggleTaskCompletion(task);
      scheduleUndo({
        kind: "complete",
        task: {
          ...task,
          completed: true,
          completedAt: new Date().toISOString(),
        },
        message: "Task completed",
      });
    } else {
      void startTimer(task);
    }
  }

  function handleTaskPress(task: DisplayTask) {
    if (task._isHabit && task._habitId) {
      navigation.navigate("HabitDetail", { habitId: task._habitId });
      return;
    }
    navigation.navigate("TaskDetail", { taskId: task.id });
  }

  if (screenBootLoading) {
    return <LoadingScreen title="Loading tasks" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Pressable style={styles.sortBtn} onPress={() => setSortVisible(true)}>
          <AppIcon name="arrow-up-down" size={16} color={colors.text} />
          <Text style={styles.sortBtnText}>Sort</Text>
        </Pressable>
      </View>

      {/* Categories */}
      <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Task List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            category={item.categoryId ? categoriesById.get(item.categoryId) ?? null : null}
            isHabit={!!(item as DisplayTask)._isHabit}
            onToggle={handleToggleTask}
            onDelete={(id) => handleDeleteTask(id)}
            onSwipeLeft={(t) => handleSwipeLeft(t as DisplayTask)}
            onPress={(t) => handleTaskPress(t as DisplayTask)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <AppIcon name="inbox" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No tasks</Text>
            <Text style={styles.emptyText}>
              {archiveMode
                ? "No completed tasks yet."
                : selectedCategory
                  ? "No tasks in this category for the selected date."
                  : "Tap + to add your first task."}
            </Text>
          </View>
        }
        contentContainerStyle={listData.length === 0 ? styles.emptyContainer : styles.listContent}
        style={styles.list}
      />

      <Pressable style={styles.newTaskFab} onPress={() => setFormVisible(true)}>
        <AppIcon name="plus" size={22} color="#fff" />
        <Text style={styles.newTaskFabText}>New Task</Text>
      </Pressable>

      {/* Bottom: Date Strip + Add Button */}
      <View style={styles.bottomBar}>
        <View style={styles.dateStripContainer}>
          <DateStrip selectedDate={selectedDate} onSelectDate={handleDateChange} />
        </View>
        <Pressable
          style={[styles.archiveIconBtn, archiveMode && styles.archiveIconBtnActive]}
          onPress={() => setArchiveMode((prev) => !prev)}
        >
          <AppIcon name="package" size={20} color={archiveMode ? colors.accent : colors.mutedText} />
        </Pressable>
      </View>

      {undoState && (
        <View style={styles.undoBar}>
          <View style={styles.undoProgressTrack}>
            <View style={[styles.undoProgressFill, { width: `${Math.max(0, Math.min(1, undoProgress)) * 100}%` }]} />
          </View>
          <Text style={styles.undoText}>{undoState.message}</Text>
          <Pressable onPress={handleUndo} hitSlop={10}>
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
        </View>
      )}

      {/* Modals */}
      <TaskForm
        visible={formVisible}
        categories={categories}
        defaultDate={selectedDate}
        defaultCategoryId={selectedCategory}
        onCancel={() => setFormVisible(false)}
        onSubmit={handleCreateTask}
      />
      <SortModal
        visible={sortVisible}
        current={sortMode}
        onSelect={setSortMode}
        onClose={() => setSortVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.xs,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.accent,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  errorText: {
    color: colors.danger,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: fontSize.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    lineHeight: 20,
    fontSize: fontSize.sm,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  dateStripContainer: {
    flex: 1,
  },
  archiveIconBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  archiveIconBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  newTaskFab: {
    position: "absolute",
    right: spacing.lg,
    bottom: 92,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
  },
  newTaskFabText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  undoBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 74,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  undoProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: colors.border,
  },
  undoProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  undoText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  undoAction: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
