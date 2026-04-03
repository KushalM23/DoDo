import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { TaskForm } from "@/components/forms/TaskForm";
import { DateWheelPickerModal } from "@/components/overlays/DateWheelPickerModal";
import { CategoriesManager } from "@/components/overlays/ManageCategoriesModal";
import { cx } from "@/lib/tw";
import { useCategories } from "@/providers/CategoriesContext";
import { useHabits } from "@/providers/HabitsContext";
import { usePreferences } from "@/providers/PreferencesContext";
import { useTasks } from "@/providers/TasksContext";
import type { Category } from "@/types/category";
import type { Habit } from "@/types/habit";
import type { Task } from "@/types/task";
import { hapticImpact, hapticSuccess } from "@/utils/haptics";
import { habitAppliesToDate, minuteToIso } from "@/utils/habits";
import { playTaskCompleteSound } from "@/utils/sounds";
import { sortTasks } from "@/utils/taskSort";
import { toLocalDateKey } from "@/utils/dateTime";
import {
  formatTaskTriggerLabel,
  parseDateKey,
} from "@/components/overlays/DateWheelPickerUtils";

type DisplayTask = Task & {
  _isHabit?: boolean;
  _habitId?: string;
  _habitIcon?: Habit["icon"];
};

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
    description: "",
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
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  h = h ? h : 12;
  const minStr = m < 10 ? "0" + m : m;
  return `${h}:${minStr} ${ampm}`;
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
  const hourStr = hours === 1 ? "1 hour" : `${hours} hours`;
  if (remaining === 0) {
    return hourStr;
  }
  return `${hourStr} ${remaining} min`;
}

function priorityMeta(priority: number): {
  icon: AppIconName;
  color: string;
} {
  if (priority === 3) {
    return { icon: "arrow-up-circle", color: "var(--high-priority)" };
  }
  if (priority === 2) {
    return { icon: "minus-circle", color: "var(--medium-priority)" };
  }
  return { icon: "arrow-down-circle", color: "var(--low-priority)" };
}

function TaskSlab({
  task,
  onToggle,
  onPress,
  categories,
}: {
  task: DisplayTask;
  onToggle: (task: DisplayTask) => void;
  onPress: (task: DisplayTask) => void;
  categories: Category[];
}) {
  const [pressed, setPressed] = useState(false);

  let leadingIcon: AppIconName;
  let leadingColor: string;

  if (task._isHabit && task._habitIcon) {
    leadingIcon = task._habitIcon as AppIconName;
    leadingColor = "var(--habit-badge)";
  } else {
    const category = categories.find((entry) => entry.id === task.categoryId);
    leadingIcon = (category?.icon ?? "check-circle") as AppIconName;
    leadingColor = category?.color ?? "var(--accent)";
  }

  const rightMeta = task._isHabit
    ? { icon: "repeat" as AppIconName, color: "var(--habit-badge)" }
    : priorityMeta(task.priority);

  return (
    <article
      className="mb-3 px-1 py-4.5"
      style={{
        opacity: task.completed ? 0.5 : 1,
        transform: `scale(${pressed ? 0.98 : 1})`,
        transition: "transform 140ms ease",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-3.5 bg-transparent text-left"
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onClick={() => onPress(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPress(task);
          }
        }}
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(task);
          }}
        >
          <AppIcon
            name={task.completed ? "check" : leadingIcon}
            size={24}
            color={leadingColor}
          />
        </button>

        <div className="flex-1">
          <h3
            className={cx(
              "m-0 font-display-semibold text-[22px] tracking-[0.4px]",
              task.completed ? "text-muted-text line-through" : "text-text",
            )}
          >
            {task.title}
          </h3>
          <p
            className={cx(
              "mt-[5px] font-sans-medium text-[13px] text-muted-text",
              task.completed && "line-through",
            )}
          >
            {formatTaskTime(task.scheduledAt)}
            {formatDuration(task.durationMinutes)
              ? ` • ${formatDuration(task.durationMinutes)}`
              : null}
          </p>
        </div>

        <span className="p-1.5">
          <AppIcon name={rightMeta.icon} size={16} color={rightMeta.color} />
        </span>
      </div>
    </article>
  );
}

export function TasksScreen() {
  const router = useRouter();
  const { tasks, refresh, addTask, toggleTaskCompletion } = useTasks();
  const { habits, loadHistory, isHabitCompletedOn, setHabitCompletedOn } =
    useHabits();
  const { categories } = useCategories();
  const { preferences } = usePreferences();
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() =>
    toLocalDateKey(new Date()),
  );
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageRailRef = useRef<HTMLDivElement | null>(null);
  const railSyncingRef = useRef(false);
  const railSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void loadHistory({ startDate: selectedDate, endDate: selectedDate });
  }, [loadHistory, selectedDate]);

  const allFilteredTasks = useMemo(() => {
    const dateTasks: DisplayTask[] = tasks.filter(
      (task) => !task.completed && isSameDay(task.scheduledAt, selectedDate),
    );
    const habitTasks: DisplayTask[] = habits
      .filter((habit) => habitAppliesToDate(habit, selectedDate))
      .filter((habit) => !isHabitCompletedOn(habit.id, selectedDate))
      .map((habit) => habitToTask(habit, selectedDate, false));
    return sortTasks([...dateTasks, ...habitTasks], "time_asc");
  }, [habits, isHabitCompletedOn, selectedDate, tasks]);

  const completedTasks = useMemo(() => {
    const dateTasks: DisplayTask[] = tasks.filter(
      (task) => task.completed && isSameDay(task.scheduledAt, selectedDate),
    );
    const habitTasks: DisplayTask[] = habits
      .filter((habit) => habitAppliesToDate(habit, selectedDate))
      .filter((habit) => isHabitCompletedOn(habit.id, selectedDate))
      .map((habit) => habitToTask(habit, selectedDate, true));
    return sortTasks([...dateTasks, ...habitTasks], "time_asc");
  }, [habits, isHabitCompletedOn, selectedDate, tasks]);

  const pages = useMemo(() => {
    const overview = {
      key: "overview",
      heading: formatTaskTriggerLabel(selectedDate),
      tasks: allFilteredTasks,
      completed: completedTasks,
    };
    const categoryPages = categories.map((category) => ({
      key: category.id,
      heading: category.name,
      tasks: allFilteredTasks.filter((task) => task.categoryId === category.id),
      completed: completedTasks.filter(
        (task) => task.categoryId === category.id,
      ),
    }));
    return [overview, ...categoryPages];
  }, [allFilteredTasks, categories, completedTasks, selectedDate]);

  useEffect(() => {
    setCurrentPageIndex((prev) =>
      Math.min(prev, Math.max(0, pages.length - 1)),
    );
  }, [pages.length]);

  useEffect(() => {
    return () => {
      if (railSyncTimerRef.current != null) {
        window.clearTimeout(railSyncTimerRef.current);
      }
    };
  }, []);

  const currentPage = pages[currentPageIndex] ?? pages[0];
  const totalCount = currentPage.tasks.length + currentPage.completed.length;
  const progress =
    totalCount > 0 ? currentPage.completed.length / totalCount : 0;
  const defaultCategoryId = currentPageIndex > 0 ? currentPage.key : null;

  async function handleToggle(task: DisplayTask) {
    if (!task.completed) {
      hapticSuccess();
      playTaskCompleteSound();
    } else {
      hapticImpact("light");
    }

    if (task._isHabit && task._habitId) {
      await setHabitCompletedOn(task._habitId, selectedDate, !task.completed);
      return;
    }

    await toggleTaskCompletion(task);
  }

  function handlePress(task: DisplayTask) {
    router.push(
      task._isHabit && task._habitId
        ? `/habits/${task._habitId}`
        : `/tasks/${task.id}`,
    );
  }

  function goToPage(nextIndex: number) {
    setCurrentPageIndex(Math.max(0, Math.min(pages.length - 1, nextIndex)));
  }

  useEffect(() => {
    if (!pageRailRef.current) {
      return;
    }
    const rail = pageRailRef.current;
    const targetLeft = currentPageIndex * rail.clientWidth;
    if (Math.abs(rail.scrollLeft - targetLeft) < 2) {
      return;
    }

    railSyncingRef.current = true;
    rail.scrollTo({
      left: targetLeft,
      behavior: "smooth",
    });

    if (railSyncTimerRef.current != null) {
      window.clearTimeout(railSyncTimerRef.current);
    }
    railSyncTimerRef.current = window.setTimeout(() => {
      railSyncingRef.current = false;
      railSyncTimerRef.current = null;
    }, 380);
  }, [currentPageIndex]);

  function handleRailScroll() {
    if (!pageRailRef.current) {
      return;
    }
    if (railSyncingRef.current) {
      return;
    }
    const rail = pageRailRef.current;
    if (rail.clientWidth <= 0) {
      return;
    }
    const nextIndex = Math.round(rail.scrollLeft / rail.clientWidth);
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));
    if (clamped !== currentPageIndex) {
      setCurrentPageIndex(clamped);
    }
  }

  function handleRailWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!pageRailRef.current) {
      return;
    }
    const horizontalIntent =
      event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!horizontalIntent) {
      return;
    }
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
    pageRailRef.current.scrollBy({ left: delta, behavior: "auto" });
  }

  return (
    <div className="grid h-full min-h-0 gap-6 pt-4 xl:grid-cols-[minmax(0,1fr)_560px]">
      <section className="relative flex min-h-0 flex-col overflow-hidden px-2 pb-28 pt-2 sm:px-3 xl:px-4">
        <button
          type="button"
          onClick={() => {
            if (currentPageIndex === 0) {
              setIsDatePickerOpen(true);
            }
          }}
          className="mx-auto mb-2 text-center font-display font-bold text-[38px] capitalize tracking-[-0.5px] text-text"
        >
          {currentPage.heading}
        </button>

        {currentPageIndex !== 0 && (
          <button
            type="button"
            className="absolute right-2 top-3 inline-grid h-11 w-11 place-items-center rounded-full sm:right-3 xl:right-4"
            onClick={() => setCategoriesVisible(true)}
          >
            <AppIcon name="package" size={24} color="var(--accent)" />
          </button>
        )}

        {totalCount > 0 && (
          <div className="mx-auto mt-1 flex w-full max-w-[460px] items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-light">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <strong className="font-body-bold text-xs tracking-[0.2px] text-muted-text">
              {currentPage.completed.length}/{totalCount} done
            </strong>
          </div>
        )}

        <div className="mt-5 flex-1 overflow-hidden">
          <div
            ref={pageRailRef}
            className="hide-scrollbar scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
            onScroll={handleRailScroll}
            onWheel={handleRailWheel}
          >
            {pages.map((page) => (
              <div
                key={page.key}
                className="h-full w-full shrink-0 snap-start overflow-y-auto pb-24 pr-1"
              >
                {[...page.tasks, ...page.completed].map((task) => (
                  <TaskSlab
                    key={task.id}
                    task={task}
                    onToggle={(next) => {
                      void handleToggle(next);
                    }}
                    onPress={handlePress}
                    categories={categories}
                  />
                ))}

                {page.tasks.length === 0 && page.completed.length === 0 && (
                  <div className="pt-10 text-center">
                    <h3 className="m-0 font-body-bold text-[22px] tracking-[-0.5px] text-text">
                      Nothing here.
                    </h3>
                    <p className="mt-1 font-body-medium text-sm text-muted-text">
                      Full clear!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-background via-background/90 to-transparent" />

        <div className="absolute bottom-20 left-0 right-0 z-20 flex items-center justify-center gap-6">
          <button
            type="button"
            className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-muted-text transition disabled:opacity-30"
            onClick={() => goToPage(currentPageIndex - 1)}
            disabled={currentPageIndex === 0}
            aria-label="Previous page"
          >
            <AppIcon name="chevron-left" size={20} />
          </button>

          <div className="flex items-center gap-4">
            {pages.map((page, index) => (
              <button
                key={page.key}
                type="button"
                className={cx(
                  "rounded-full transition-all duration-200",
                  currentPageIndex === index
                    ? "h-2 w-5 bg-accent"
                    : "h-2 w-2 bg-surface-light",
                )}
                aria-label={`Go to ${page.heading}`}
                onClick={() => goToPage(index)}
              />
            ))}
          </div>

          <button
            type="button"
            className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-muted-text transition disabled:opacity-30"
            onClick={() => goToPage(currentPageIndex + 1)}
            disabled={currentPageIndex === pages.length - 1}
            aria-label="Next page"
          >
            <AppIcon name="chevron-right" size={20} />
          </button>
        </div>
      </section>

      <aside className="min-h-0 overflow-hidden xl:border-l xl:border-border xl:pl-6">
        <TaskForm
          visible
          variant="panel"
          categories={categories}
          defaultDate={selectedDate}
          defaultCategoryId={defaultCategoryId}
          dateFormat={preferences.dateFormat}
          timeFormat={preferences.timeFormat}
          weekStart={preferences.weekStart}
          onCancel={() => {}}
          onSubmit={addTask}
        />
      </aside>

      <CategoriesManager
        open={categoriesVisible}
        onClose={() => setCategoriesVisible(false)}
      />

      <DateWheelPickerModal
        mode="task-date"
        visible={isDatePickerOpen}
        value={parseDateKey(selectedDate)}
        onClose={() => setIsDatePickerOpen(false)}
        onConfirm={(value) => {
          setSelectedDate(toLocalDateKey(value));
          setIsDatePickerOpen(false);
          void refresh(toLocalDateKey(value));
        }}
      />
    </div>
  );
}
