import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAlert } from "../../state/AlertContext";
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
import { fonts } from "../../theme/fonts";
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
  const { showAlert } = useAlert();
  const route = useRoute<RouteProp<RootStackParamList, "TaskDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tasks, loading: tasksLoading, initialized: tasksInitialized, toggleTaskCompletion, removeTask, updateTaskDetails } = useTasks();
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
      showAlert("Failed to postpone", err instanceof Error ? err.message : "Unknown error");
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
      showAlert("Failed to save notes", err instanceof Error ? err.message : "Unknown error");
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
          <Pressable style={styles.postponePopup} onPress={() => { }}>
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
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  lockClockWrap: {
    alignItems: "center",
    marginTop: spacing.xs,
  },
  lockClockLine: {
    color: "#fff",
    fontSize: 96,
    fontFamily: fonts.heading,
    lineHeight: 112,
    letterSpacing: -4,
    includeFontPadding: false,
  },
  lockInfoBlock: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  lockTitle: {
    color: "#F5F5F5",
    fontSize: fontSize.xl,
    fontFamily: fonts.headingMedium,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  lockMeta: {
    color: "#666",
    fontSize: fontSize.sm,
    textAlign: "center",
    fontFamily: fonts.body,
  },
  lockActionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    width: "100%",
  },
  lockActionBtn: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111",
  },
  lockActionText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyBold,
  },
  lockStartBtn: {
    borderColor: colors.success,
  },
  lockPauseBtn: {
    borderColor: colors.accent,
  },
  lockCompleteBtn: {
    borderColor: "#1E1E1E",
  },
  lockExitBtn: {
    alignSelf: "center",
    backgroundColor: "#111",
    borderColor: "#1E1E1E",
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: 200,
    paddingTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: fontSize.md,
    fontFamily: fonts.body,
  },
  deletedState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  deletedTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontFamily: fonts.headingSemiBold,
    letterSpacing: -0.3,
  },
  deletedText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
    flex: 1,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  label: {
    color: colors.mutedText,
    fontFamily: fonts.headingRegular,
    fontSize: fontSize.xs,
    marginBottom: 8,
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 12,
  },
  infoLabel: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodySemiBold,
    width: 90,
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodySemiBold,
    flex: 1,
  },
  infoSep: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 0,
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 2,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notesInput: {
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: fonts.body,
    lineHeight: 24,
    minHeight: 120,
  },
  noteSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    backgroundColor: colors.accentLight,
  },
  noteSaveText: {
    color: colors.accent,
    fontSize: fontSize.xs,
  },
  floatingActions: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: 78,
    gap: 8,
  },
  primaryActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  lockInBtn: {
    marginBottom: 4,
    alignSelf: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    letterSpacing: -0.1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  postponePopup: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 16,
  },
  postponeTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontFamily: fonts.headingSemiBold,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  postponeOptionList: {
    gap: 8,
    marginTop: 8,
  },
  postponeOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 16,
  },
  postponeOptionText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: fonts.bodySemiBold,
  },
  postponeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  postponeCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  postponeCancelText: {
    color: colors.mutedText,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
  },
  postponeSaveBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  postponeSaveText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
  },
  undoBar: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  undoProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.border,
  },
  undoProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  undoText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodySemiBold,
  },
  undoAction: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyBold,
  },
});
