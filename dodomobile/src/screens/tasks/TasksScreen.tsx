import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Feather";
import { useTasks } from "../../state/TasksContext";
import { useHabits } from "../../state/HabitsContext";
import { useCategories } from "../../state/CategoriesContext";
import { TaskForm } from "../../components/TaskForm";
import { TaskItem } from "../../components/TaskItem";
import { CategoryBar } from "../../components/CategoryBar";
import { DateStrip } from "../../components/DateStrip";
import { SortModal } from "../../components/SortModal";
import { colors, spacing, radii, fontSize } from "../../theme/colors";
import type { CreateTaskInput, Task } from "../../types/task";
import type { Habit } from "../../types/habit";

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

export function TasksScreen() {
  const { tasks, loading, error, sortMode, setSortMode, refresh, addTask, removeTask, toggleTaskCompletion, startTimer } = useTasks();
  const { habits } = useHabits();
  const { categories } = useCategories();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  // Track local habit completion/timer state for the session
  const [habitState, setHabitState] = useState<Record<string, { completed?: boolean; timerStartedAt?: string | null }>>({});

  // Filter tasks and merge habits
  const filteredTasks = useMemo(() => {
    // Regular tasks
    const dateTasks = tasks.filter((t) => {
      const dateMatch = isSameDay(t.scheduledAt, selectedDate);
      if (!dateMatch) return false;
      if (selectedCategory === null) return true;
      return t.categoryId === selectedCategory;
    });

    // Habit-derived tasks (only in Overview / no category filter)
    const habitTasks: DisplayTask[] = selectedCategory === null
      ? habits
          .filter((h) => habitAppliesToDate(h, selectedDate))
          .map((h) => {
            const base = habitToTask(h, selectedDate);
            const state = habitState[base.id];
            if (state) {
              return { ...base, completed: state.completed ?? false, timerStartedAt: state.timerStartedAt ?? null };
            }
            return base;
          })
      : [];

    return [...dateTasks, ...habitTasks];
  }, [tasks, habits, selectedDate, selectedCategory, habitState]);

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
    try {
      await addTask(input);
    } catch (err) {
      Alert.alert("Failed to create task", err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }

  function handleDeleteTask(taskId: string) {
    if (taskId.startsWith("habit_")) {
      // Can't delete habit from task list, just hide it
      setHabitState((prev) => ({ ...prev, [taskId]: { ...prev[taskId], completed: true } }));
      return;
    }
    removeTask(taskId).catch((err) => {
      Alert.alert("Failed to delete task", err instanceof Error ? err.message : "Unknown error");
    });
  }

  function handleToggleTask(task: DisplayTask) {
    if (task._isHabit) {
      setHabitState((prev) => ({
        ...prev,
        [task.id]: { ...prev[task.id], completed: !task.completed },
      }));
      return;
    }
    toggleTaskCompletion(task).catch((err) => {
      Alert.alert("Failed to update task", err instanceof Error ? err.message : "Unknown error");
    });
  }

  function handleSwipeLeft(task: DisplayTask) {
    if (task._isHabit) {
      if (task.timerStartedAt && !task.completed) {
        setHabitState((prev) => ({ ...prev, [task.id]: { ...prev[task.id], completed: true } }));
      } else if (!task.completed) {
        setHabitState((prev) => ({ ...prev, [task.id]: { ...prev[task.id], timerStartedAt: new Date().toISOString() } }));
      }
      return;
    }

    if (task.timerStartedAt && !task.completed) {
      toggleTaskCompletion(task).catch((err) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
      });
    } else if (!task.completed) {
      startTimer(task).catch((err) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
      });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Pressable style={styles.sortBtn} onPress={() => setSortVisible(true)}>
          <Icon name="sliders" size={16} color={colors.text} />
          <Text style={styles.sortBtnText}>Sort</Text>
        </Pressable>
      </View>

      {/* Categories */}
      <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            isHabit={!!(item as DisplayTask)._isHabit}
            onToggle={handleToggleTask}
            onDelete={(id) => handleDeleteTask(id)}
            onSwipeLeft={(t) => handleSwipeLeft(t as DisplayTask)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="inbox" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No tasks</Text>
            <Text style={styles.emptyText}>
              {selectedCategory ? "No tasks in this category for the selected date." : "Tap + to add your first task."}
            </Text>
          </View>
        }
        contentContainerStyle={filteredTasks.length === 0 ? styles.emptyContainer : styles.listContent}
        style={styles.list}
      />

      {/* Bottom: Date Strip + Add Button */}
      <View style={styles.bottomBar}>
        <View style={styles.dateStripContainer}>
          <DateStrip selectedDate={selectedDate} onSelectDate={handleDateChange} />
        </View>
        <Pressable style={styles.addBtn} onPress={() => setFormVisible(true)}>
          <Icon name="plus" size={24} color="#fff" />
        </Pressable>
      </View>

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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
});
