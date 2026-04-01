import React, {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {useAlert} from '@/providers/AlertContext';
import {useCategories} from '@/providers/CategoriesContext';
import {useHabits} from '@/providers/HabitsContext';
import {useTasks} from '@/providers/TasksContext';
import {playTaskCompleteSound} from '@/utils/sounds';
import {hapticImpact, hapticSuccess} from '@/utils/haptics';
import {habitAppliesToDate, minuteToIso} from '@/utils/habits';
import {toLocalDateKey} from '@/utils/dateTime';
import {sortTasks} from '@/utils/taskSort';
import type {Category, CreateCategoryInput} from '@/types/category';
import type {Habit} from '@/types/habit';
import type {CreateTaskInput, Priority, Task} from '@/types/task';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from '@/types/category';

type DisplayTask = Task & {
  _isHabit?: boolean;
  _habitId?: string;
  _habitIcon?: Habit['icon'];
};

function formatDateTitle(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isSameDay(iso: string, dateKey: string) {
  return toLocalDateKey(new Date(iso)) === dateKey;
}

function habitToTask(
  habit: Habit,
  dateKey: string,
  completed: boolean,
): DisplayTask {
  const minute = habit.timeMinute ?? 9 * 60;
  const duration = habit.durationMinutes ?? 30;
  return {
    id: `habit_${habit.id}_${dateKey}`,
    _isHabit: true,
    _habitId: habit.id,
    _habitIcon: habit.icon,
    title: habit.title,
    description: '',
    categoryId: null,
    scheduledAt: minuteToIso(dateKey, minute),
    deadline: minuteToIso(dateKey, Math.min(1439, minute + duration)),
    durationMinutes: duration,
    priority: 2,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    timerStartedAt: null,
    actualDurationSeconds: 0,
    actualDurationMinutes: 0,
    completionXp: 0,
    createdAt: habit.createdAt,
  };
}

function formatTaskTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) {
    return null;
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
}

function priorityMeta(priority: number): {icon: AppIconName; className: string} {
  if (priority === 3) {
    return {icon: 'arrow-up-circle', className: 'priority-high'};
  }
  if (priority === 2) {
    return {icon: 'minus-circle', className: 'priority-medium'};
  }
  return {icon: 'arrow-down-circle', className: 'priority-low'};
}

function TaskComposer({
  open,
  onClose,
  onSubmit,
  categories,
  defaultDate,
  defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  categories: Category[];
  defaultDate: string;
  defaultCategoryId: string | null;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState<Priority>(2);
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle('');
    setDescription('');
    setDate(defaultDate);
    setTime('09:00');
    setDurationMinutes(60);
    setPriority(2);
    setCategoryId(defaultCategoryId);
  }, [defaultCategoryId, defaultDate, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="overlay-layer">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>New Task</h3>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>

        <div className="form-stack">
          <label className="field">
            <span>Task Name</span>
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Dodo's task" />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Optional notes"
            />
          </label>

          <div className="form-grid two">
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={event => setDate(event.target.value)} />
            </label>
            <label className="field">
              <span>Time</span>
              <input type="time" value={time} onChange={event => setTime(event.target.value)} />
            </label>
          </div>

          <div className="form-grid two">
            <label className="field">
              <span>Duration</span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={event => setDurationMinutes(Number(event.target.value) || 1)}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={categoryId ?? ''}
                onChange={event => setCategoryId(event.target.value || null)}>
                <option value="">None</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
                className={`chip ${priority === value ? 'active' : ''}`}
                onClick={() => setPriority(value as Priority)}>
                {value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High'}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="action-pill muted" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="action-pill accent"
            disabled={busy || !title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const [hours, minutes] = time.split(':').map(Number);
                const scheduledAt = new Date(`${date}T00:00:00`);
                scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);
                const deadline = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
                await onSubmit({
                  title: title.trim(),
                  description: description.trim(),
                  categoryId,
                  scheduledAt: scheduledAt.toISOString(),
                  deadline: deadline.toISOString(),
                  durationMinutes,
                  priority,
                });
                onClose();
              } finally {
                setBusy(false);
              }
            }}>
            {busy ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {showAlert} = useAlert();
  const {categories, addCategory, editCategory, removeCategory, setCategoryOrder} =
    useCategories();
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft('');
    setColor(DEFAULT_CATEGORY_COLOR);
    setIcon(DEFAULT_CATEGORY_ICON);
    setEditingId(null);
  }, [open]);

  async function saveCategory() {
    const input: CreateCategoryInput = {
      name: draft.trim(),
      color,
      icon,
    };
    if (!input.name) {
      showAlert('Name required', 'Please enter a category name.');
      return;
    }
    if (editingId) {
      await editCategory(editingId, input);
    } else {
      await addCategory(input);
    }
    setDraft('');
    setColor(DEFAULT_CATEGORY_COLOR);
    setIcon(DEFAULT_CATEGORY_ICON);
    setEditingId(null);
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const index = categories.findIndex(category => category.id === categoryId);
    if (index === -1) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) {
      return;
    }
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    await setCategoryOrder(next.map(category => category.id));
  }

  if (!open) {
    return null;
  }

  return (
    <div className="overlay-layer">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>Categories</h3>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span>Name</span>
            <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Category name" />
          </label>
          <label className="field">
            <span>Icon</span>
            <select value={icon} onChange={event => setIcon(event.target.value as typeof icon)}>
              {CATEGORY_ICON_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="color-row">
          {CATEGORY_COLOR_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              className={`color-swatch ${color === option ? 'active' : ''}`}
              style={{background: option}}
              onClick={() => setColor(option)}
            />
          ))}
        </div>

        <div className="modal-actions align-start">
          <button type="button" className="action-pill accent" onClick={() => void saveCategory()}>
            {editingId ? 'Save Category' : 'Add Category'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="action-pill muted"
              onClick={() => {
                setEditingId(null);
                setDraft('');
                setColor(DEFAULT_CATEGORY_COLOR);
                setIcon(DEFAULT_CATEGORY_ICON);
              }}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="category-list">
          {categories.map(category => (
            <div key={category.id} className="category-row">
              <div className="category-row-main">
                <span className="category-dot" style={{background: category.color}} />
                <AppIcon name={category.icon as AppIconName} size={16} color={category.color} />
                <strong>{category.name}</strong>
              </div>
              <div className="row-actions">
                <button type="button" className="icon-button subtle" onClick={() => void moveCategory(category.id, -1)}>
                  <AppIcon name="chevron-up" size={16} />
                </button>
                <button type="button" className="icon-button subtle" onClick={() => void moveCategory(category.id, 1)}>
                  <AppIcon name="chevron-down" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={() => {
                    setEditingId(category.id);
                    setDraft(category.name);
                    setColor(category.color);
                    setIcon(category.icon);
                  }}>
                  <AppIcon name="edit" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() =>
                    showAlert('Delete category?', `Delete "${category.name}"?`, [
                      {text: 'Cancel', style: 'cancel'},
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          void removeCategory(category.id);
                        },
                      },
                    ])
                  }>
                  <AppIcon name="trash-2" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TasksScreen() {
  const router = useRouter();
  const {tasks, loading, refresh, addTask, toggleTaskCompletion} = useTasks();
  const {habits, loadHistory, isHabitCompletedOn, setHabitCompletedOn} = useHabits();
  const {categories} = useCategories();
  const [formVisible, setFormVisible] = useState(false);
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [currentPageKey, setCurrentPageKey] = useState('overview');

  useEffect(() => {
    void loadHistory({startDate: selectedDate, endDate: selectedDate});
  }, [loadHistory, selectedDate]);

  const allFilteredTasks = useMemo(() => {
    const dateTasks: DisplayTask[] = tasks.filter(
      task => !task.completed && isSameDay(task.scheduledAt, selectedDate),
    );
    const habitTasks: DisplayTask[] = habits
      .filter(habit => habitAppliesToDate(habit, selectedDate))
      .filter(habit => !isHabitCompletedOn(habit.id, selectedDate))
      .map(habit => habitToTask(habit, selectedDate, false));
    return sortTasks([...dateTasks, ...habitTasks], 'time_asc');
  }, [habits, isHabitCompletedOn, selectedDate, tasks]);

  const completedTasks = useMemo(() => {
    const dateTasks: DisplayTask[] = tasks.filter(
      task => task.completed && isSameDay(task.scheduledAt, selectedDate),
    );
    const habitTasks: DisplayTask[] = habits
      .filter(habit => habitAppliesToDate(habit, selectedDate))
      .filter(habit => isHabitCompletedOn(habit.id, selectedDate))
      .map(habit => habitToTask(habit, selectedDate, true));
    return sortTasks([...dateTasks, ...habitTasks], 'time_asc');
  }, [habits, isHabitCompletedOn, selectedDate, tasks]);

  const pages = useMemo(() => {
    const overview = {
      key: 'overview',
      heading: formatDateTitle(selectedDate),
      tasks: allFilteredTasks,
      completed: completedTasks,
    };
    const categoryPages = categories.map(category => ({
      key: category.id,
      heading: category.name,
      tasks: allFilteredTasks.filter(task => task.categoryId === category.id),
      completed: completedTasks.filter(task => task.categoryId === category.id),
    }));
    return [overview, ...categoryPages];
  }, [allFilteredTasks, categories, completedTasks, selectedDate]);

  useEffect(() => {
    if (!pages.some(page => page.key === currentPageKey)) {
      setCurrentPageKey('overview');
    }
  }, [currentPageKey, pages]);

  const currentPage = pages.find(page => page.key === currentPageKey) ?? pages[0];
  const totalCount = currentPage.tasks.length + currentPage.completed.length;
  const progress = totalCount > 0 ? currentPage.completed.length / totalCount : 0;

  async function handleToggle(task: DisplayTask) {
    if (!task.completed) {
      hapticSuccess();
      playTaskCompleteSound();
    } else {
      hapticImpact('light');
    }

    if (task._isHabit && task._habitId) {
      await setHabitCompletedOn(task._habitId, selectedDate, !task.completed);
      return;
    }

    await toggleTaskCompletion(task);
  }

  return (
    <div className="page-grid tasks-grid">
      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h1>Tasks</h1>
            <p>Daily work plus habit commitments for the selected date.</p>
          </div>
        </div>

        <label className="field">
          <span>Date</span>
          <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
        </label>

        <div className="action-stack">
          <button type="button" className="action-pill accent wide" onClick={() => setFormVisible(true)}>
            <AppIcon name="plus" size={18} />
            <span>Add Task</span>
          </button>
          <button type="button" className="action-pill muted wide" onClick={() => setCategoriesVisible(true)}>
            <AppIcon name="package" size={18} />
            <span>Manage Categories</span>
          </button>
        </div>

        <div className="page-tab-list">
          {pages.map(page => (
            <button
              key={page.key}
              type="button"
              className={`page-tab ${currentPageKey === page.key ? 'active' : ''}`}
              onClick={() => setCurrentPageKey(page.key)}>
              {page.heading}
            </button>
          ))}
        </div>
      </section>

      <section className="desktop-panel flex-panel">
        <div className="panel-header">
          <div>
            <h2>{currentPage.heading}</h2>
            <p>{currentPage.completed.length} complete, {currentPage.tasks.length} remaining</p>
          </div>
          <button type="button" className="icon-button subtle" onClick={() => void refresh(selectedDate)}>
            <AppIcon name="rotate-ccw" size={18} />
          </button>
        </div>

        <div className="progress-strip">
          <div className="progress-bar">
            <span style={{width: `${Math.round(progress * 100)}%`}} />
          </div>
          <strong>{currentPage.completed.length}/{totalCount || 0} done</strong>
        </div>

        <div className="task-list">
          {[...currentPage.tasks, ...currentPage.completed].map(task => {
            const category = task.categoryId
              ? categories.find(entry => entry.id === task.categoryId) ?? null
              : null;
            const leadingIcon = task._isHabit
              ? (task._habitIcon as AppIconName)
              : ((category?.icon ?? 'check-circle') as AppIconName);
            const leadingColor = task._isHabit
              ? 'var(--habit-badge)'
              : category?.color ?? 'var(--accent)';
            const rightMeta = task._isHabit
              ? {icon: 'repeat' as AppIconName, className: 'habit-chip'}
              : priorityMeta(task.priority);

            return (
              <article
                key={task.id}
                className={`task-card ${task.completed ? 'completed' : ''}`}
                onClick={() =>
                  router.push(task._isHabit && task._habitId ? `/habits/${task._habitId}` : `/tasks/${task.id}`)
                }>
                <button
                  type="button"
                  className="task-toggle"
                  onClick={event => {
                    event.stopPropagation();
                    void handleToggle(task);
                  }}>
                  <AppIcon
                    name={task.completed ? 'check' : leadingIcon}
                    size={22}
                    color={leadingColor}
                  />
                </button>

                <div className="task-copy">
                  <h3>{task.title}</h3>
                  <p>
                    {formatTaskTime(task.scheduledAt)}
                    {formatDuration(task.durationMinutes) ? ` • ${formatDuration(task.durationMinutes)}` : ''}
                  </p>
                </div>

                <div className={`task-meta ${rightMeta.className}`}>
                  <AppIcon
                    name={rightMeta.icon}
                    size={16}
                    color={task._isHabit ? 'var(--habit-badge)' : 'currentColor'}
                  />
                </div>
              </article>
            );
          })}

          {currentPage.tasks.length === 0 && currentPage.completed.length === 0 ? (
            <div className="empty-block">
              <h3>Nothing here.</h3>
              <p>Full clear.</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="desktop-panel">
        <div className="panel-header">
          <div>
            <h2>Overview</h2>
            <p>Desktop summary for the selected page.</p>
          </div>
        </div>

        <div className="stat-stack">
          <div className="stat-card">
            <span>Pending</span>
            <strong>{currentPage.tasks.length}</strong>
          </div>
          <div className="stat-card">
            <span>Completed</span>
            <strong>{currentPage.completed.length}</strong>
          </div>
          <div className="stat-card">
            <span>Categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="stat-card">
            <span>Loading</span>
            <strong>{loading ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      </aside>

      <TaskComposer
        open={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmit={addTask}
        categories={categories}
        defaultDate={selectedDate}
        defaultCategoryId={currentPageKey === 'overview' ? null : currentPageKey}
      />

      <CategoriesManager open={categoriesVisible} onClose={() => setCategoriesVisible(false)} />
    </div>
  );
}
