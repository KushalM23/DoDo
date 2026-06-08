import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HabitComposer } from "@/components/forms/HabitComposer";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useHabits } from "@/providers/HabitsContext";
import { usePreferences } from "@/providers/PreferencesContext";
import type { Habit } from "@/types/habit";
import { cx } from "@/lib/tw";

function HabitGridItem({
  habit,
  onPress,
}: {
  habit: Habit;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  let frequencyLabel = "daily";
  if (habit.frequencyType === "interval") {
    frequencyLabel = `every ${habit.intervalDays} days`;
  } else if (habit.frequencyType === "custom_days") {
    frequencyLabel = `${habit.customDays.length}x / week`;
  }

  return (
    <article
      style={{
        transform: `scale(${pressed ? 0.95 : 1})`,
        transition: "transform 170ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <button
        type="button"
        className={cx(
          "flex h-[130px] w-full flex-col items-center justify-center gap-2.5 rounded-[16px] bg-surface-light px-4 text-center border transition",
          habit.isPaused ? "border-border/30 opacity-75" : "border-transparent"
        )}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        onClick={onPress}
      >
        <AppIcon
          name={habit.icon as AppIconName}
          size={32}
          color="var(--habit-badge)"
        />

        <div className="grid justify-items-center gap-0.5 px-1">
          <strong className="line-clamp-2 font-sans-bold text-base tracking-[-0.2px] text-text">
            {habit.title}
          </strong>
          <div className="flex items-center gap-1.5 mt-0.5 justify-center">
            <span className="font-sans-semibold text-xs text-muted-text">
              {frequencyLabel}
            </span>
            {habit.isPaused && (
              <span className="inline-flex items-center gap-0.5 rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-sans-bold uppercase tracking-wider text-muted-text">
                Paused
              </span>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}

export function HabitsScreen() {
  const router = useRouter();
  const { preferences } = usePreferences();
  const { habits, addHabit, initialized } = useHabits();

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.title.localeCompare(b.title)),
    [habits],
  );

  if (!initialized) {
    return <LoadingScreen title="Loading habits" />;
  }

  return (
    <div className="grid h-full min-h-0 gap-6 pt-4 xl:grid-cols-[minmax(0,1fr)_560px]">
      <section className="relative flex min-h-0 flex-col overflow-hidden px-2 pb-28 pt-2 sm:px-3 xl:px-4">
        <h1 className="text-center font-display text-[40px] tracking-[-0.8px] text-text">
          Your Habits
        </h1>

        <div className="mt-4 flex-1 overflow-y-auto pb-24 pr-1">
          {sortedHabits.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sortedHabits.map((habit) => (
                <HabitGridItem
                  key={habit.id}
                  habit={habit}
                  onPress={() => router.push(`/habits/${habit.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="grid h-full place-items-center">
              <div className="grid gap-1.5 text-center">
                <h3 className="m-0 font-display text-[26px] tracking-[-0.5px] text-text">
                  No habits active
                </h3>
                <p className="m-0 font-sans-semibold text-base text-muted-text">
                  Hit the plus button to start
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-background via-background/90 to-transparent" />
      </section>

      <aside className="min-h-0 overflow-hidden xl:border-l xl:border-border xl:pl-6">
        <HabitComposer
          mode="create"
          timeFormat={preferences.timeFormat}
          onSubmit={addHabit}
        />
      </aside>
    </div>
  );
}
