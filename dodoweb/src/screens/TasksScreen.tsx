import React, {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {cx, tw} from '@/lib/tw';
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
    return {icon: 'arrow-up-circle', className: 'text-high-priority'};
  }
  if (priority === 2) {
    return {icon: 'minus-circle', className: 'text-medium-priority'};
  }
  return {icon: 'arrow-down-circle', className: 'text-low-priority'};
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
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-[min(100vw-32px,720px)] rounded-[28px] border border-border bg-surface p-[22px] shadow-[0_24px_60px_var(--shadow)]" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4">
          <h3>New Task</h3>
          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>

        <div className="mt-4 grid gap-3.5">
          <label className="grid gap-2">
            <span>Task Name</span>
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Dodo's task" />
          </label>

          <label className="grid gap-2">
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Optional notes"
            />
          </label>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span>Date</span>
              <input type="date" value={date} onChange={event => setDate(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span>Time</span>
              <input type="time" value={time} onChange={event => setTime(event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span>Duration</span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={event => setDurationMinutes(Number(event.target.value) || 1)}
              />
            </label>
            <label className="grid gap-2">
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

          <div className="flex flex-wrap gap-3">
            {[1, 2, 3].map(value => (
              <button
                key={value}
                type="button"
                className={cx(tw.chip, priority === value && tw.chipActive)}
                onClick={() => setPriority(value as Priority)}>
                {value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
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
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-[min(100vw-32px,720px)] rounded-[28px] border border-border bg-surface p-[22px] shadow-[0_24px_60px_var(--shadow)]" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4">
          <h3>Categories</h3>
          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="grid gap-2">
            <span>Name</span>
            <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Category name" />
          </label>
          <label className="grid gap-2">
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

        <div className="flex flex-wrap gap-3">
          {CATEGORY_COLOR_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              className={cx(
                'h-[42px] w-[42px] rounded-full border-[3px] border-transparent transition hover:-translate-y-px',
                color === option && 'border-text',
              )}
              style={{background: option}}
              onClick={() => setColor(option)}
            />
          ))}
        </div>

        <div className="mt-5 flex justify-start gap-3">
          <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => void saveCategory()}>
            {editingId ? 'Save Category' : 'Add Category'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
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

        <div className="grid gap-3.5">
          {categories.map(category => (
            <div key={category.id} className="flex items-center gap-[14px] rounded-[22px] border border-transparent bg-surface p-4">
              <div className="flex flex-1 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background: category.color}} />
                <AppIcon name={category.icon as AppIconName} size={16} color={category.color} />
                <strong>{category.name}</strong>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => void moveCategory(category.id, -1)}>
                  <AppIcon name="chevron-up" size={16} />
                </button>
                <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => void moveCategory(category.id, 1)}>
                  <AppIcon name="chevron-down" size={16} />
                </button>
                <button
                  type="button"
                  className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px"
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
                  className="inline-grid h-10 w-10 place-items-center rounded-full bg-danger-light text-danger transition hover:-translate-y-px"
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
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
      <section className="rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className={tw.h1}>Tasks</h1>
            <p className={tw.muted}>Daily work plus habit commitments for the selected date.</p>
          </div>
        </div>

        <label className="grid gap-2">
          <span className={tw.fieldLabel}>Date</span>
          <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
        </label>

        <div className="grid gap-3.5">
          <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setFormVisible(true)}>
            <AppIcon name="plus" size={18} />
            <span>Add Task</span>
          </button>
          <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setCategoriesVisible(true)}>
            <AppIcon name="package" size={18} />
            <span>Manage Categories</span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {pages.map(page => (
            <button
              key={page.key}
              type="button"
              className={cx(
                'min-h-[42px] rounded-full bg-surface-light px-4 text-muted-text transition hover:-translate-y-px',
                currentPageKey === page.key && 'bg-accent text-white',
              )}
              onClick={() => setCurrentPageKey(page.key)}>
              {page.heading}
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-[72vh] flex-col rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={tw.h2}>{currentPage.heading}</h2>
            <p className={tw.muted}>{currentPage.completed.length} complete, {currentPage.tasks.length} remaining</p>
          </div>
          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => void refresh(selectedDate)}>
            <AppIcon name="rotate-ccw" size={18} />
          </button>
        </div>

        <div className="my-[18px] flex items-center gap-[14px]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-light">
            <span className="block h-full rounded-full bg-accent" style={{width: `${Math.round(progress * 100)}%`}} />
          </div>
          <strong>{currentPage.completed.length}/{totalCount || 0} done</strong>
        </div>

        <div className="grid gap-3.5">
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
              ? {icon: 'repeat' as AppIconName, className: 'text-habit-badge'}
              : priorityMeta(task.priority);

            return (
              <article
                key={task.id}
                className={cx(
                  'flex cursor-pointer items-center gap-[14px] rounded-[22px] border border-transparent bg-surface p-4',
                  task.completed && 'opacity-65',
                )}
                onClick={() =>
                  router.push(task._isHabit && task._habitId ? `/habits/${task._habitId}` : `/tasks/${task.id}`)
                }>
                <button
                  type="button"
                  className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-transparent"
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

                <div className="flex-1">
                  <h3 className="m-0 font-display-semibold tracking-[-0.3px]">{task.title}</h3>
                  <p className={tw.muted}>
                    {formatTaskTime(task.scheduledAt)}
                    {formatDuration(task.durationMinutes) ? ` • ${formatDuration(task.durationMinutes)}` : ''}
                  </p>
                </div>

                <div className={cx('text-muted-text', rightMeta.className)}>
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
            <div className="grid gap-2 text-center">
              <h3 className="m-0 font-display-semibold tracking-[-0.3px]">Nothing here.</h3>
              <p className={tw.muted}>Full clear.</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={tw.h2}>Overview</h2>
            <p className={tw.muted}>Desktop summary for the selected page.</p>
          </div>
        </div>

        <div className="grid gap-3.5">
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span className={tw.muted}>Pending</span>
            <strong>{currentPage.tasks.length}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span className={tw.muted}>Completed</span>
            <strong>{currentPage.completed.length}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span className={tw.muted}>Categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="grid gap-1.5 rounded-[22px] bg-surface p-4">
            <span className={tw.muted}>Loading</span>
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

