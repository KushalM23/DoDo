import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {FocusModeView} from '@/components/common/FocusModeView';
import {HoldToConfirmButton} from '@/components/common/HoldToConfirmButton';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {useAlert} from '@/providers/AlertContext';
import {useCategories} from '@/providers/CategoriesContext';
import {usePreferences} from '@/providers/PreferencesContext';
import {useTasks} from '@/providers/TasksContext';
import {playFocusEnterSound, playFocusExitSound} from '@/utils/sounds';
import {hapticImpact} from '@/utils/haptics';
import {formatDate, formatDateTime, formatTime} from '@/utils/dateTime';
import {getTaskTrackedSeconds} from '@/utils/taskTiming';
import type {CreateTaskInput, Priority, Task} from '@/types/task';

function priorityLabel(priority: Priority) {
  return priority === 3 ? 'High' : priority === 2 ? 'Medium' : 'Low';
}

function getTaskDurationMinutes(task: Task): number {
  if (task.durationMinutes != null && Number.isFinite(task.durationMinutes)) {
    return Math.max(1, task.durationMinutes);
  }
  const inferred = Math.round(
    (new Date(task.deadline).getTime() - new Date(task.scheduledAt).getTime()) / 60000,
  );
  return Math.max(1, inferred || 60);
}

export function TaskDetailScreen() {
  const params = useParams<{taskId: string}>();
  const taskId = typeof params.taskId === 'string' ? params.taskId : '';
  const router = useRouter();
  const {showAlert} = useAlert();
  const {
    tasks,
    loading,
    initialized,
    startTimer,
    pauseTimer,
    toggleTaskCompletion,
    removeTask,
    updateTaskDetails,
  } = useTasks();
  const {categories, initialized: categoriesInitialized} = useCategories();
  const {preferences} = usePreferences();

  const task = tasks.find(entry => entry.id === taskId);
  const [titleDraft, setTitleDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<Priority>(2);
  const [scheduledDateDraft, setScheduledDateDraft] = useState('');
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState('');
  const [durationMinutesDraft, setDurationMinutesDraft] = useState(60);
  const [categoryIdDraft, setCategoryIdDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [lockInMode, setLockInMode] = useState(false);
  const [lockTime, setLockTime] = useState(() => new Date());
  const [savingDetails, setSavingDetails] = useState(false);

  const autoSaveTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const lastAutoSavedSignatureRef = useRef('');
  const autoSaveErrorShownRef = useRef(false);

  useEffect(() => {
    if (!task) {
      return;
    }
    const scheduledAt = new Date(task.scheduledAt);
    setTitleDraft(task.title);
    setPriorityDraft(task.priority);
    setScheduledDateDraft(scheduledAt.toISOString().slice(0, 10));
    setScheduledTimeDraft(
      `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`,
    );
    setDurationMinutesDraft(getTaskDurationMinutes(task));
    setCategoryIdDraft(task.categoryId);
    lastAutoSavedSignatureRef.current = '';
    autoSaveErrorShownRef.current = false;
  }, [task]);

  useEffect(() => {
    if (!lockInMode) {
      return;
    }
    const timer = window.setInterval(() => setLockTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [lockInMode]);

  useEffect(() => {
    if (!lockInMode || !task || task.completed || task.timerStartedAt) {
      return;
    }
    void startTimer(task);
  }, [lockInMode, startTimer, task]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      if (undoTimerRef.current != null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const category = task?.categoryId ? categories.find(entry => entry.id === task.categoryId) ?? null : null;
  const selectedCategory = categoryIdDraft
    ? categories.find(entry => entry.id === categoryIdDraft) ?? null
    : null;
  const focusElapsedSeconds = useMemo(
    () => (task ? getTaskTrackedSeconds(task, lockTime) : 0),
    [lockTime, task],
  );

  const hasChanges = useMemo(() => {
    if (!task) {
      return false;
    }
    const originalDuration = getTaskDurationMinutes(task);
    const scheduledAt = new Date(task.scheduledAt);
    const originalDate = scheduledAt.toISOString().slice(0, 10);
    const originalTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(
      scheduledAt.getMinutes(),
    ).padStart(2, '0')}`;

    return (
      titleDraft.trim() !== task.title ||
      priorityDraft !== task.priority ||
      categoryIdDraft !== task.categoryId ||
      durationMinutesDraft !== originalDuration ||
      scheduledDateDraft !== originalDate ||
      scheduledTimeDraft !== originalTime
    );
  }, [
    categoryIdDraft,
    durationMinutesDraft,
    priorityDraft,
    scheduledDateDraft,
    scheduledTimeDraft,
    task,
    titleDraft,
  ]);

  useEffect(() => {
    if (!task || busy || pendingDelete || savingDetails || !hasChanges || !titleDraft.trim()) {
      return;
    }
    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    const signature = [
      titleDraft.trim(),
      priorityDraft,
      categoryIdDraft ?? 'none',
      durationMinutesDraft,
      scheduledDateDraft,
      scheduledTimeDraft,
    ].join('|');

    if (signature === lastAutoSavedSignatureRef.current) {
      return;
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      const scheduledAt = new Date(`${scheduledDateDraft}T${scheduledTimeDraft}:00`);
      const deadline = new Date(scheduledAt.getTime() + durationMinutesDraft * 60 * 1000);

      const input: CreateTaskInput = {
        title: titleDraft.trim(),
        description: task.description ?? '',
        categoryId: categoryIdDraft,
        scheduledAt: scheduledAt.toISOString(),
        deadline: deadline.toISOString(),
        durationMinutes: durationMinutesDraft,
        priority: priorityDraft,
      };

      setSavingDetails(true);
      void updateTaskDetails(task.id, input)
        .then(() => {
          lastAutoSavedSignatureRef.current = signature;
          autoSaveErrorShownRef.current = false;
        })
        .catch(error => {
          if (!autoSaveErrorShownRef.current) {
            showAlert(
              'Failed to update task',
              error instanceof Error ? error.message : 'Unknown error',
            );
            autoSaveErrorShownRef.current = true;
          }
        })
        .finally(() => {
          setSavingDetails(false);
        });
    }, 450);
  }, [
    busy,
    categoryIdDraft,
    durationMinutesDraft,
    hasChanges,
    priorityDraft,
    pendingDelete,
    savingDetails,
    scheduledDateDraft,
    scheduledTimeDraft,
    showAlert,
    task,
    titleDraft,
    updateTaskDetails,
  ]);

  if (!initialized || !categoriesInitialized || (loading && tasks.length === 0)) {
    return <LoadingScreen title="Loading task" />;
  }

  if (!task) {
    return (
      <div className="detail-page">
        <div className="detail-card empty-card">
          <h1>Task not found</h1>
          <Link href="/tasks" className="action-pill accent">
            Back to tasks
          </Link>
        </div>
      </div>
    );
  }
  const currentTask = task;

  function clearUndoTimer() {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function scheduleDelete(taskId: string) {
    clearUndoTimer();
    setPendingDelete(true);
    undoTimerRef.current = window.setTimeout(() => {
      void removeTask(taskId).then(() => router.push('/tasks'));
      setPendingDelete(false);
      undoTimerRef.current = null;
    }, 3000);
  }

  async function handleComplete() {
    if (pendingDelete) {
      return;
    }
    setBusy(true);
    try {
      await toggleTaskCompletion(currentTask);
    } finally {
      setBusy(false);
    }
  }

  async function handleExitFocus() {
    setLockInMode(false);
    playFocusExitSound();
    hapticImpact('soft');
    if (!currentTask.completed && currentTask.timerStartedAt) {
      try {
        await pauseTimer(currentTask);
      } catch (error) {
        showAlert(
          'Failed to pause timer',
          error instanceof Error ? error.message : 'Unable to pause focus timer.',
        );
      }
    }
  }

  function handleDelete() {
    if (busy || pendingDelete || savingDetails) {
      return;
    }

    showAlert('Delete task?', 'This action cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          scheduleDelete(currentTask.id);
        },
      },
    ]);
  }

  if (lockInMode) {
    return (
      <FocusModeView
        now={lockTime}
        timeFormat={preferences.timeFormat}
        title={currentTask.title}
        metaLines={[
          `${category?.name ?? 'None'} | ${priorityLabel(currentTask.priority)}`,
          `Due ${formatDateTime(currentTask.deadline, {
            dateFormat: preferences.dateFormat,
            timeFormat: preferences.timeFormat,
            weekStart: preferences.weekStart,
          })}`,
        ]}
        elapsedSeconds={focusElapsedSeconds}
        onExitFocus={() => {
          void handleExitFocus();
        }}
        actionLabel={currentTask.completed ? 'Undo' : 'Complete'}
        actionIconName={currentTask.completed ? 'rotate-ccw' : 'check'}
        onActionPress={() => {
          void handleComplete();
        }}
        actionDisabled={busy || savingDetails}
        actionDone={currentTask.completed}
      />
    );
  }

  if (pendingDelete) {
    return (
      <div className="detail-page">
        <section className="detail-card empty-card">
          <h1>Task deleted</h1>
          <p>Removing task in a moment.</p>
          <div className="action-row">
            <button
              type="button"
              className="action-pill muted"
              onClick={() => {
                clearUndoTimer();
                setPendingDelete(false);
              }}>
              Undo
            </button>
            <button
              type="button"
              className="action-pill danger"
              onClick={() => {
                clearUndoTimer();
                void removeTask(currentTask.id).then(() => router.push('/tasks'));
              }}>
              Delete Now
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <section className="detail-card">
        <div className="detail-header">
          <div>
            <Link href="/tasks" className="back-link">
              <AppIcon name="chevron-left" size={18} />
              <span>Back to tasks</span>
            </Link>
            <input
              className="detail-title-input"
              value={titleDraft}
              onChange={event => setTitleDraft(event.target.value)}
            />
          </div>
          <div className="row-actions">
            <button type="button" className="icon-button subtle" onClick={() => router.push('/tasks')}>
              <AppIcon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={scheduledDateDraft}
              onChange={event => setScheduledDateDraft(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Time</span>
            <input
              type="time"
              value={scheduledTimeDraft}
              onChange={event => setScheduledTimeDraft(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Duration</span>
            <input
              type="number"
              min={1}
              value={durationMinutesDraft}
              onChange={event => setDurationMinutesDraft(Number(event.target.value) || 1)}
            />
          </label>

          <label className="field">
            <span>Category</span>
            <select
              value={categoryIdDraft ?? ''}
              onChange={event => setCategoryIdDraft(event.target.value || null)}>
              <option value="">None</option>
              {categories.map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="priority-row">
          {[1, 2, 3].map(value => (
            <button
              key={value}
              type="button"
              className={`chip ${priorityDraft === value ? 'active' : ''}`}
              onClick={() => setPriorityDraft(value as Priority)}>
              {value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High'}
            </button>
          ))}
        </div>

        <div className="detail-summary-grid">
          <div className="stat-card">
            <span>Scheduled</span>
            <strong>{formatDate(new Date(currentTask.scheduledAt), preferences.dateFormat)}</strong>
          </div>
          <div className="stat-card">
            <span>Start</span>
            <strong>{formatTime(new Date(currentTask.scheduledAt), preferences.timeFormat)}</strong>
          </div>
          <div className="stat-card">
            <span>Category</span>
            <strong>{selectedCategory?.name ?? 'None'}</strong>
          </div>
          <div className="stat-card">
            <span>Progress</span>
            <strong>{currentTask.completed ? 'Done' : 'Active'}</strong>
          </div>
        </div>

        <div className="detail-footer">
          <HoldToConfirmButton
            iconName="lock"
            onHoldComplete={() => {
              setLockInMode(true);
              playFocusEnterSound();
              hapticImpact('heavy');
            }}
            holdDurationMs={1500}
            size={84}
          />

          <div className="action-row">
            <button
              type="button"
              className={`action-pill ${currentTask.completed ? 'muted accent-text' : 'accent'} wide`}
              disabled={busy || pendingDelete || savingDetails}
              onClick={() => {
                void handleComplete();
              }}>
              <AppIcon name={currentTask.completed ? 'rotate-ccw' : 'check'} size={18} />
              <span>{currentTask.completed ? 'Undo' : 'Complete'}</span>
            </button>

            <button
              type="button"
              className="action-pill danger wide"
              disabled={busy || pendingDelete || savingDetails}
              onClick={handleDelete}>
              <AppIcon name="trash-2" size={18} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
