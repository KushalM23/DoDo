import React, {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {HabitComposer} from '@/components/forms/HabitComposer';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {cx, tw} from '@/lib/tw';
import {useHabits} from '@/providers/HabitsContext';

export function HabitsScreen() {
  const router = useRouter();
  const {habits, addHabit, initialized} = useHabits();
  const [formVisible, setFormVisible] = useState(false);

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.title.localeCompare(b.title)),
    [habits],
  );

  if (!initialized) {
    return <LoadingScreen title="Loading habits" />;
  }

  return (
    <div className={tw.pageGrid}>
      <section className={tw.panel}>
        <div className={tw.header}>
          <div>
            <h1 className={tw.h1}>Your Habits</h1>
            <p className={tw.muted}>Desktop view of your recurring routines and streak builders.</p>
          </div>
          <button type="button" className={cx(tw.action, tw.actionAccent)} onClick={() => setFormVisible(true)}>
            <AppIcon name="plus" size={18} />
            <span>Add Habit</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {sortedHabits.map(habit => {
            const frequencyLabel =
              habit.frequencyType === 'daily'
                ? 'Every day'
                : habit.frequencyType === 'interval'
                ? `Every ${habit.intervalDays} days`
                : `${habit.customDays.length}x / week`;

            return (
              <article
                key={habit.id}
                className={cx(
                  tw.card,
                  'min-h-[130px] flex-1 cursor-pointer flex-col justify-center text-center',
                )}
                onClick={() => router.push(`/habits/${habit.id}`)}>
                <AppIcon name={habit.icon as AppIconName} size={32} color="var(--habit-badge)" />
                <div>
                  <h3 className="m-0 font-display-semibold tracking-[-0.3px]">{habit.title}</h3>
                  <p className={tw.muted}>{frequencyLabel}</p>
                </div>
              </article>
            );
          })}

          {sortedHabits.length === 0 ? (
            <div className="grid gap-2 text-center">
              <h3 className="m-0 font-display-semibold tracking-[-0.3px]">No habits active</h3>
              <p className={tw.muted}>Hit the plus button to start.</p>
            </div>
          ) : null}
        </div>
      </section>

      <HabitComposer open={formVisible} onClose={() => setFormVisible(false)} onSubmit={addHabit} />
    </div>
  );
}

