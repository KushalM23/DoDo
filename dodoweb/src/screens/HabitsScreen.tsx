import React, {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {HabitComposer} from '@/components/forms/HabitComposer';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {LoadingScreen} from '@/components/common/LoadingScreen';
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
    <div className="page-grid single">
      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h1>Your Habits</h1>
            <p>Desktop view of your recurring routines and streak builders.</p>
          </div>
          <button type="button" className="action-pill accent" onClick={() => setFormVisible(true)}>
            <AppIcon name="plus" size={18} />
            <span>Add Habit</span>
          </button>
        </div>

        <div className="habit-grid">
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
                className="habit-card"
                onClick={() => router.push(`/habits/${habit.id}`)}>
                <AppIcon name={habit.icon as AppIconName} size={32} color="var(--habit-badge)" />
                <div>
                  <h3>{habit.title}</h3>
                  <p>{frequencyLabel}</p>
                </div>
              </article>
            );
          })}

          {sortedHabits.length === 0 ? (
            <div className="empty-block">
              <h3>No habits active</h3>
              <p>Hit the plus button to start.</p>
            </div>
          ) : null}
        </div>
      </section>

      <HabitComposer open={formVisible} onClose={() => setFormVisible(false)} onSubmit={addHabit} />
    </div>
  );
}
