import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTasks } from "../../state/TasksContext";
import { useCategories } from "../../state/CategoriesContext";
import { usePreferences } from "../../state/PreferencesContext";
import { AppIcon } from "../../components/AppIcon";
import { HoldToConfirmButton } from "../../components/HoldToConfirmButton";
import { TaskForm } from "../../components/TaskForm";
import { CustomDateTimePicker } from "../../components/CustomDateTimePicker";
import { LoadingScreen } from "../../components/LoadingScreen";
import { spacing, radii, fontSize } from "../../theme/colors";
import { type ThemeColors, useThemeColors, useThemeMode } from "../../theme/ThemeProvider";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import type { CreateTaskInput, Priority } from "../../types/task";
import { formatDateTime, toLocalDateKey } from "../../utils/dateTime";

type UndoState =
  | {
      kind: "complete";
      task: CreateTaskInput & {
        id: string;
        completed: boolean;
        completedAt: string | null;
        timerStartedAt: string | null;
        actualDurationMinutes: number;
        completionXp: number;
        createdAt: string;
      };
      message: string;
    }
  | { kind: "delete"; taskId: string; message: string };

function localDateOnly(iso: string): string {
  return toLocalDateKey(iso);
}

function priorityMeta(priority: Priority, colors: ThemeColors): { label: string; color: string; icon: "arrow-down-circle" | "minus-circle" | "arrow-up-circle" } {
  if (priority === 3) return { label: "High", color: colors.highPriority, icon: "arrow-up-circle" };
  if (priority === 2) return { label: "Medium", color: colors.mediumPriority, icon: "minus-circle" };
  return { label: "Low", color: colors.lowPriority, icon: "arrow-down-circle" };
}

export function TaskDetailScreen() {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const route = useRoute<RouteProp<RootStackParamList, "TaskDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tasks, loading: tasksLoading, initialized: tasksInitialized, toggleTaskCompletion, startTimer, pauseTimer, removeTask, updateTaskDetails } = useTasks();
  const { categories, loading: categoriesLoading, initialized: categoriesInitialized } = useCategories();
  const { preferences } = usePreferences();

  const taskId = route.params.taskId;
  const task = tasks.find((t) => t.id === taskId);

  const [editVisible, setEditVisible] = useState(false);
  const [postponeVisible, setPostponeVisible] = useState(false);
  const [postponeMode, setPostponeMode] = useState<"options" | "custom">("options");
  const [postponeDate, setPostponeDate] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState(task?.description ?? "");
  const [hasStartedInSession, setHasStartedInSession] = useState(!!task?.timerStartedAt);
  const [savingNote, setSavingNote] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [undoProgress, setUndoProgress] = useState(0);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setNoteDraft(task?.description ?? "");
  }, [task?.id, task?.description]);

  useEffect(() => {
    setHasStartedInSession(!!task?.timerStartedAt);
  }, [task?.id]);

  useEffect(() => {
    if (task?.timerStartedAt) setHasStartedInSession(true);
  }, [task?.timerStartedAt]);

  useEffect(() => {
    if (!lockInMode) return;
    const timer = setInterval(() => setLockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [lockInMode]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      if (undoProgressTimerRef.current) {
        clearInterval(undoProgressTimerRef.current);
      }
    };
  }, []);

  const category = task?.categoryId ? categories.find((c) => c.id === task.categoryId) ?? null : null;
  const categoryName = category?.name ?? "None";

  const priorityInfo = useMemo(() => (task ? priorityMeta(task.priority, colors) : null), [task, colors]);

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoProgressTimerRef.current) {
      clearInterval(undoProgressTimerRef.current);
      undoProgressTimerRef.current = null;
    }
  }

  function scheduleUndo(next: UndoState) {
    clearUndoTimer();
    setUndoState(next);
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
      if (next.kind === "delete") {
        void removeTask(next.taskId).finally(() => navigation.goBack());
      }
      setPendingDelete(false);
      setUndoState(null);
      setUndoProgress(0);
      undoTimerRef.current = null;
    }, 3000);
  }

  function handleUndo() {
    if (!undoState) return;
    clearUndoTimer();

    if (undoState.kind === "complete") {
      void toggleTaskCompletion(undoState.task);
    }

    if (undoState.kind === "delete") {
      setPendingDelete(false);
    }

    setUndoState(null);
    setUndoProgress(0);
  }

  async function handleComplete() {
    if (!task || busy || pendingDelete) return;

    if (task.completed) {
      setBusy(true);
      try {
        await toggleTaskCompletion(task);
      } finally {
        setBusy(false);
      }
      return;
    }

    const completedSnapshot = {
      ...task,
      completed: true,
      completedAt: new Date().toISOString(),
    };

    setBusy(true);
    try {
      await toggleTaskCompletion(task);
      scheduleUndo({ kind: "complete", task: completedSnapshot, message: "Task completed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleStartOrResume() {
    if (!task || task.completed || pendingDelete) return;
    setHasStartedInSession(true);
    void startTimer(task);
  }

  async function handlePause() {
    if (!task || !task.timerStartedAt || pendingDelete) return;
    void pauseTimer(task);
  }

  function handleDelete() {
    if (!task) return;
    setPendingDelete(true);
    scheduleUndo({ kind: "delete", taskId: task.id, message: "Task deleted" });
  }

  async function postponeTo(nextScheduledAt: Date) {
    if (!task || busy || pendingDelete) return;

    const durationMs = task.durationMinutes != null
      ? task.durationMinutes * 60 * 1000
      : Math.max(0, new Date(task.deadline).getTime() - new Date(task.scheduledAt).getTime());
    const nextDeadline = new Date(nextScheduledAt.getTime() + durationMs);

    setBusy(true);
    try {
      await updateTaskDetails(task.id, {
        scheduledAt: nextScheduledAt.toISOString(),
        deadline: nextDeadline.toISOString(),
      });
    } catch (err) {
      Alert.alert("Failed to postpone", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function handlePostpone() {
    if (!task) return;
    setPostponeDate(new Date(task.scheduledAt));
    setPostponeMode("options");
    setPostponeVisible(true);
  }

  async function handleEditSubmit(input: CreateTaskInput) {
    if (!task) return;
    await updateTaskDetails(task.id, input);
    setEditVisible(false);
  }

  async function handleSaveNote() {
    if (!task || savingNote) return;
    const trimmed = noteDraft.trim();
    const current = (task.description ?? "").trim();
    if (trimmed === current) return;
    setSavingNote(true);
    try {
      await updateTaskDetails(task.id, { description: trimmed });
    } catch (err) {
      Alert.alert("Failed to save notes", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingNote(false);
    }
  }

  if (!tasksInitialized || !categoriesInitialized || (tasksLoading && tasks.length === 0) || (categoriesLoading && categories.length === 0)) {
    return <LoadingScreen title="Loading task" />;
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <AppIcon name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Task</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showStart = !task.completed && !task.timerStartedAt && !hasStartedInSession;
  const showResume = !task.completed && !task.timerStartedAt && hasStartedInSession;
  const showPause = !task.completed && !!task.timerStartedAt;

  if (lockInMode) {
    const hour24 = lockTime.getHours();
    const lockHour = String(preferences.timeFormat === "24h" ? hour24 : ((hour24 + 11) % 12) + 1).padStart(2, "0");
    const lockMinute = String(lockTime.getMinutes()).padStart(2, "0");

    return (
      <SafeAreaView style={styles.lockContainer} edges={["top", "bottom"]}>
        <View style={styles.lockContent}>
          <View style={styles.lockClockWrap}>
            <Text style={styles.lockClockLine}>{lockHour}</Text>
            <Text style={styles.lockClockLine}>{lockMinute}</Text>
          </View>

          <View style={styles.lockInfoBlock}>
            <Text style={styles.lockTitle} numberOfLines={2}>{task.title}</Text>
            <Text style={styles.lockMeta}>{categoryName} · {priorityInfo?.label ?? "Priority"}</Text>
            <Text style={styles.lockMeta}>Due {formatDateTime(task.deadline, {
              dateFormat: preferences.dateFormat,
              timeFormat: preferences.timeFormat,
              weekStart: preferences.weekStart,
            })}</Text>
          </View>

          <View style={styles.lockActionsRow}>
            {showStart || showResume ? (
              <Pressable style={[styles.lockActionBtn, styles.lockStartBtn]} onPress={handleStartOrResume}>
                <AppIcon name="play" size={16} color={colors.success} />
                <Text style={[styles.lockActionText, { color: colors.success }]}>{showStart ? "Start" : "Resume"}</Text>
              </Pressable>
            ) : null}
            {showPause ? (
              <Pressable style={[styles.lockActionBtn, styles.lockPauseBtn]} onPress={handlePause}>
                <AppIcon name="clock" size={16} color={colors.accent} />
                <Text style={[styles.lockActionText, { color: colors.accent }]}>Pause</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.lockActionBtn, styles.lockCompleteBtn]} onPress={handleComplete} disabled={busy}>
              <AppIcon name="check" size={16} color={task.completed ? colors.mutedText : colors.accent} />
              <Text style={[styles.lockActionText, { color: task.completed ? colors.mutedText : colors.accent }]}>
                {task.completed ? "Undo" : "Complete"}
              </Text>
            </Pressable>
          </View>

          <HoldToConfirmButton
            iconName="lock-open"
            onHoldComplete={() => setLockInMode(false)}
            holdDurationMs={3000}
            square
            size={80}
            progressStyle="fill"
            showHint={false}
            style={styles.lockExitBtn}
            fillColor={colors.danger}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <AppIcon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{task.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1 }}>
        {!pendingDelete ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <AppIcon name="calendar" size={14} color={colors.mutedText} />
              <Text style={styles.infoLabel}>Scheduled</Text>
              <Text style={styles.infoValue}>
                {formatDateTime(task.scheduledAt, {
                  dateFormat: preferences.dateFormat,
                  timeFormat: preferences.timeFormat,
                  weekStart: preferences.weekStart,
                })}
              </Text>
            </View>
            <View style={styles.infoSep} />
            <View style={styles.infoRow}>
              <AppIcon name="clock" size={14} color={colors.mutedText} />
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{task.durationMinutes ? `${task.durationMinutes} min` : "-"}</Text>
            </View>
            <View style={styles.infoSep} />
            <View style={styles.infoRow}>
              <AppIcon name={category?.icon ?? "inbox"} size={14} color={category?.color ?? colors.mutedText} />
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{categoryName}</Text>
            </View>
            <View style={styles.infoSep} />
            <View style={styles.infoRow}>
              <AppIcon name={priorityInfo?.icon ?? "minus-circle"} size={14} color={priorityInfo?.color ?? colors.mutedText} />
              <Text style={styles.infoLabel}>Priority</Text>
              <Text style={styles.infoValue}>{priorityInfo?.label ?? "-"}</Text>
            </View>
          </View>

          <View style={styles.notesHeader}>
            <Text style={styles.label}>Notes</Text>
            <Pressable style={styles.noteSaveBtn} onPress={handleSaveNote} disabled={savingNote}>
              <AppIcon name="save" size={14} color={savingNote ? colors.mutedText : colors.accent} />
            </Pressable>
          </View>
          <View style={styles.notesCard}>
            <TextInput
              style={styles.notesInput}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Add notes..."
              placeholderTextColor={colors.mutedText}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
        ) : (
          <View style={styles.deletedState}>
            <AppIcon name="trash-2" size={24} color={colors.danger} />
            <Text style={styles.deletedTitle}>Task deleted</Text>
            <Text style={styles.deletedText}>Undo within 3 seconds to restore it.</Text>
          </View>
        )}
      </View>

      <View style={styles.floatingActions}>
        <HoldToConfirmButton
          iconName="lock"
          onHoldComplete={() => setLockInMode(true)}
          holdDurationMs={1500}
          square
          size={80}
          progressStyle="fill"
          showHint={false}
          style={styles.lockInBtn}
          fillColor={colors.accent}
        />

        <View style={styles.primaryActionsRow}>
        {showStart && (
          <Pressable style={[styles.actionBtn, styles.startBtn]} onPress={handleStartOrResume}>
            <AppIcon name="play" size={18} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Start</Text>
          </Pressable>
        )}

        {showResume && (
          <Pressable style={[styles.actionBtn, styles.startBtn]} onPress={handleStartOrResume}>
            <AppIcon name="play" size={18} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Resume</Text>
          </Pressable>
        )}

        {showPause && (
          <Pressable style={[styles.actionBtn, styles.pauseBtn]} onPress={handlePause}>
            <AppIcon name="clock" size={18} color={colors.accent} />
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Pause</Text>
          </Pressable>
        )}

        <Pressable style={[styles.actionBtn, styles.completeBtn]} onPress={handleComplete} disabled={busy}>
          <AppIcon name="check" size={18} color={task.completed ? colors.mutedText : colors.accent} />
          <Text style={[styles.actionBtnText, { color: task.completed ? colors.mutedText : colors.accent }]}>
            {task.completed ? "Undo" : "Complete"}
          </Text>
        </Pressable>
        </View>

        <View style={styles.secondaryActionsRow}>
        <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setEditVisible(true)} disabled={busy}>
          <AppIcon name="edit" size={18} color={colors.text} />
          <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, styles.postponeBtn]} onPress={handlePostpone} disabled={busy}>
          <AppIcon name="calendar" size={18} color={colors.text} />
          <Text style={[styles.actionBtnText, { color: colors.text }]}>Postpone</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete} disabled={busy}>
          <AppIcon name="trash-2" size={18} color={colors.danger} />
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
        </View>
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

      <TaskForm
        visible={editVisible}
        mode="edit"
        submitLabel="Save Changes"
        initialValues={{
          title: task.title,
          description: task.description,
          categoryId: task.categoryId,
          scheduledAt: task.scheduledAt,
          deadline: task.deadline,
          durationMinutes: task.durationMinutes,
          priority: task.priority,
        }}
        categories={categories}
        defaultDate={localDateOnly(task.scheduledAt)}
        defaultCategoryId={task.categoryId}
        onCancel={() => setEditVisible(false)}
        onSubmit={handleEditSubmit}
      />

      <Modal transparent animationType="fade" visible={postponeVisible} onRequestClose={() => setPostponeVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPostponeVisible(false)}>
          <Pressable style={styles.postponePopup} onPress={() => {}}>
            <Text style={styles.postponeTitle}>Postpone task</Text>

            {postponeMode === "options" ? (
              <View style={styles.postponeOptionList}>
                <Pressable
                  style={styles.postponeOptionBtn}
                  onPress={() => {
                    const next = new Date(task.scheduledAt);
                    next.setDate(next.getDate() + 1);
                    setPostponeVisible(false);
                    void postponeTo(next);
                  }}
                >
                  <AppIcon name="calendar" size={16} color={colors.text} />
                  <Text style={styles.postponeOptionText}>Tomorrow</Text>
                </Pressable>
                <Pressable
                  style={styles.postponeOptionBtn}
                  onPress={() => setPostponeMode("custom")}
                >
                  <AppIcon name="edit" size={16} color={colors.text} />
                  <Text style={styles.postponeOptionText}>Custom date & time</Text>
                </Pressable>
                <Pressable style={styles.postponeCancelBtn} onPress={() => setPostponeVisible(false)}>
                  <Text style={styles.postponeCancelText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <CustomDateTimePicker
                  key={`task-detail-postpone-picker-${themeMode}`}
                  value={postponeDate}
                  onChange={setPostponeDate}
                  timeFormat={preferences.timeFormat}
                  weekStart={preferences.weekStart}
                />
                <View style={styles.postponeActions}>
                  <Pressable style={styles.postponeCancelBtn} onPress={() => setPostponeMode("options")}>
                    <Text style={styles.postponeCancelText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.postponeSaveBtn}
                    onPress={() => {
                      setPostponeVisible(false);
                      void postponeTo(postponeDate);
                    }}
                  >
                    <Text style={styles.postponeSaveText}>Save</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  lockContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  lockContent: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  lockClockWrap: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.xs,
  },
  lockClockLine: {
    color: "#fff",
    fontSize: 88,
    fontWeight: "800",
    lineHeight: 110,
    letterSpacing: 0.5,
    includeFontPadding: true,
  },
  lockInfoBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  lockTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
    textAlign: "center",
  },
  lockMeta: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  lockActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  lockActionBtn: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  lockActionText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  lockStartBtn: {
    borderColor: colors.success,
  },
  lockPauseBtn: {
    borderColor: colors.accent,
  },
  lockCompleteBtn: {
    borderColor: colors.border,
  },
  lockExitBtn: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 170,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: fontSize.md,
  },
  deletedState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  deletedTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  deletedText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  label: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "600",
    width: 80,
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "500",
    flex: 1,
  },
  infoSep: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notesInput: {
    color: colors.text,
    fontSize: fontSize.md,
    lineHeight: 20,
    minHeight: 120,
  },
  noteSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  noteSaveText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  floatingActions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 58,
    gap: spacing.sm,
  },
  primaryActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  lockInBtn: {
    marginBottom: spacing.xs,
    alignSelf: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  startBtn: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  pauseBtn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  postponeBtn: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editBtn: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  completeBtn: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteBtn: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  actionBtnText: {
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  postponePopup: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  postponeTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  postponeOptionList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  postponeOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  postponeOptionText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  postponeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  postponeCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  postponeCancelText: {
    color: colors.mutedText,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  postponeSaveBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  postponeSaveText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  undoBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
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
