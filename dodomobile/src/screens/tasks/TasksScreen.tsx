import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTasks } from "../../state/TasksContext";
import { useCategories } from "../../state/CategoriesContext";
import { TaskForm } from "../../components/TaskForm";
import { TaskItem } from "../../components/TaskItem";
import { CategoryBar } from "../../components/CategoryBar";
import { DateStrip } from "../../components/DateStrip";
import { SortModal } from "../../components/SortModal";
import { colors } from "../../theme/colors";
import type { CreateTaskInput, Task } from "../../types/task";

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(isoString: string, dateStr: string): boolean {
  return isoString.startsWith(dateStr);
}

export function TasksScreen() {
  const { tasks, loading, error, sortMode, setSortMode, refresh, addTask, removeTask, toggleTaskCompletion, startTimer } = useTasks();
  const { categories } = useCategories();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  // Filter tasks by selected date and category
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const dateMatch = isSameDay(t.scheduledAt, selectedDate);
      if (!dateMatch) return false;
      if (selectedCategory === null) return true; // Overview
      return t.categoryId === selectedCategory;
    });
  }, [tasks, selectedDate, selectedCategory]);

  const handleRefresh = useCallback(() => {
    void refresh(selectedDate);
  }, [refresh, selectedDate]);

  // Refresh when date changes
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

  async function handleDeleteTask(taskId: string) {
    try {
      await removeTask(taskId);
    } catch (err) {
      Alert.alert("Failed to delete task", err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      await toggleTaskCompletion(task);
    } catch (err) {
      Alert.alert("Failed to update task", err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleSwipeRight(task: Task) {
    try {
      if (task.timerStartedAt && !task.completed) {
        // Timer already started → complete the task
        await toggleTaskCompletion(task);
      } else if (!task.completed) {
        // Start the timer
        await startTimer(task);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Pressable style={styles.sortBtn} onPress={() => setSortVisible(true)}>
          <Text style={styles.sortBtnText}>Sort ▼</Text>
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
            onToggle={handleToggleTask}
            onDelete={(id) => void handleDeleteTask(id)}
            onSwipeRight={(t) => void handleSwipeRight(t)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
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
          <Text style={styles.addBtnText}>+</Text>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
  },
  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
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
    marginLeft: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    marginTop: -2,
  },
});

