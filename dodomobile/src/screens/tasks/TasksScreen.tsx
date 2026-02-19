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
import { sortTasks } from "../../utils/taskSort";
import { colors, spacing, radii, fontSize } from "../../theme/colors";
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

/** Check if a habit should appear on the given date */
function habitAppliesToDate(habit: Habit, dateStr: string): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") {
    const created = new Date(habit.createdAt);
    const target = new Date(dateStr + "T00:00:00");
    return created.getDay() === target.getDay();
  }
  return false;
}

/** Convert a habit into a Task-shaped object for display */
function habitToTask(habit: Habit, dateStr: string): Task & { _isHabit: true; _habitId: string } {
  const scheduledAt = new Date(`${dateStr}T09:00:00`).toISOString();
  return {
    id: `habit_${habit.id}_${dateStr}`,
    _isHabit: true,
    _habitId: habit.id,
    title: habit.title,
    description: "",
    categoryId: null,
    scheduledAt,
    deadline: new Date(`${dateStr}T10:00:00`).toISOString(),
    durationMinutes: 60,
    priority: 2,
    completed: false,
    completedAt: null,
    timerStartedAt: null,
    createdAt: habit.createdAt,
  };
}

type DisplayTask = Task & { _isHabit?: boolean; _habitId?: string };
type UndoState =
  | { kind: "complete"; task: Task; message: string }
  | { kind: "delete"; task: Task; message: string };

export function TasksScreen() {
  const { tasks, loading, error, sortMode, setSortMode, refresh, addTask, removeTask, toggleTaskCompletion, startTimer } = useTasks();
  const { habits } = useHabits();
  const { categories } = useCategories();
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

  // Track local habit completion/timer state for the session
  const [habitState, setHabitState] = useState<Record<string, { completed?: boolean; timerStartedAt?: string | null }>>({});

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
    const habitTasks: DisplayTask[] = selectedCategory === null
      ? habits
          .filter((h) => habitAppliesToDate(h, selectedDate))
          .reduce<DisplayTask[]>((acc, h) => {
            const base = habitToTask(h, selectedDate);
            const state = habitState[base.id];
            const next = state
              ? { ...base, completed: state.completed ?? false, timerStartedAt: state.timerStartedAt ?? null }
              : base;
            if (!next.completed) acc.push(next);
            return acc;
          }, [])
      : [];

    return sortTasks([...dateTasks, ...habitTasks], sortMode);
  }, [tasks, habits, selectedDate, selectedCategory, habitState, sortMode]);

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
      setHabitState((prev) => ({
        ...prev,
        [task.id]: { ...prev[task.id], completed: !task.completed },
      }));
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
      setHabitState((prev) => ({
        ...prev,
        [task.id]: { ...prev[task.id], completed: !task.completed },
      }));
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
    if (task._isHabit) return;
    navigation.navigate("TaskDetail", { taskId: task.id });
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

      <Pressable
        style={[styles.archiveFab, archiveMode && styles.archiveFabActive]}
        onPress={() => setArchiveMode((prev) => !prev)}
      >
        <AppIcon name="package" size={20} color={archiveMode ? colors.accent : colors.mutedText} />
        <Text style={[styles.archiveBtnText, archiveMode && styles.archiveBtnTextActive]}>Archive</Text>
      </Pressable>

      {/* Bottom: Date Strip + Add Button */}
      <View style={styles.bottomBar}>
        <View style={styles.dateStripContainer}>
          <DateStrip selectedDate={selectedDate} onSelectDate={handleDateChange} />
        </View>
        <Pressable style={styles.addBtn} onPress={() => setFormVisible(true)}>
          <AppIcon name="plus" size={22} color="#fff" />
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

const styles = StyleSheet.create({
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
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  archiveBtnText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.mutedText,
  },
  archiveBtnTextActive: {
    color: colors.accent,
  },
  archiveFab: {
    position: "absolute",
    right: spacing.lg,
    bottom: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  archiveFabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
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
