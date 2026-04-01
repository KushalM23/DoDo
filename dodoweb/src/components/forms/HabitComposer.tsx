import React, {useEffect, useState} from 'react';
import {AppIcon} from '@/components/common/AppIcon';
import {useAlert} from '@/providers/AlertContext';
import type {CreateHabitInput, Habit, HabitFrequencyType, HabitIcon} from '@/types/habit';
import {DEFAULT_HABIT_ICON, HABIT_ICON_OPTIONS} from '@/types/habit';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type HabitComposerProps = {
  open: boolean;
  mode?: 'create' | 'edit';
  initialValues?: Habit | null;
  onClose: () => void;
  onSubmit: (input: CreateHabitInput) => Promise<void>;
};

export function HabitComposer({
  open,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
}: HabitComposerProps) {
  const {showAlert} = useAlert();
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [intervalDays, setIntervalDays] = useState(2);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [timeValue, setTimeValue] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const baseMinutes = initialValues?.timeMinute ?? 9 * 60;
    const hours = Math.floor(baseMinutes / 60);
    const minutes = baseMinutes % 60;

    setTitle(initialValues?.title ?? '');
    setIcon(initialValues?.icon ?? DEFAULT_HABIT_ICON);
    setFrequencyType(initialValues?.frequencyType ?? 'daily');
    setIntervalDays(initialValues?.intervalDays ?? 2);
    setCustomDays(initialValues?.customDays ?? []);
    setTimeValue(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    setDurationMinutes(initialValues?.durationMinutes ?? 60);
    setBusy(false);
  }, [initialValues, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="overlay-layer">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{mode === 'edit' ? 'Edit Habit' : 'New Habit'}</h3>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <AppIcon name="x" />
          </button>
        </div>

        <div className="form-stack">
          <label className="field">
            <span>Habit Name</span>
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Habit name" />
          </label>

          <label className="field">
            <span>Icon</span>
            <select value={icon} onChange={event => setIcon(event.target.value as HabitIcon)}>
              {HABIT_ICON_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="priority-row">
            {(['daily', 'interval', 'custom_days'] as HabitFrequencyType[]).map(value => (
              <button
                key={value}
                type="button"
                className={`chip ${frequencyType === value ? 'active' : ''}`}
                onClick={() => setFrequencyType(value)}>
                {value === 'daily' ? 'Every day' : value === 'interval' ? 'Every X days' : 'Custom days'}
              </button>
            ))}
          </div>

          {frequencyType === 'interval' ? (
            <label className="field">
              <span>Interval Days</span>
              <input
                type="number"
                min={2}
                max={365}
                value={intervalDays}
                onChange={event => setIntervalDays(Math.max(2, Number(event.target.value) || 2))}
              />
            </label>
          ) : null}

          {frequencyType === 'custom_days' ? (
            <div className="weekday-row">
              {WEEKDAY_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`weekday-chip ${customDays.includes(index) ? 'active' : ''}`}
                  onClick={() =>
                    setCustomDays(prev =>
                      prev.includes(index)
                        ? prev.filter(day => day !== index)
                        : [...prev, index].sort((a, b) => a - b),
                    )
                  }>
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="form-grid two">
            <label className="field">
              <span>Time</span>
              <input type="time" value={timeValue} onChange={event => setTimeValue(event.target.value)} />
            </label>
            <label className="field">
              <span>Duration</span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={event => setDurationMinutes(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
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
              if (frequencyType === 'custom_days' && customDays.length === 0) {
                showAlert('Missing days', 'Choose at least one day for custom frequency.');
                return;
              }
              setBusy(true);
              try {
                const [hours, minutes] = timeValue.split(':').map(Number);
                await onSubmit({
                  title: title.trim(),
                  icon,
                  anchorDate: new Date().toISOString().slice(0, 10),
                  frequencyType,
                  intervalDays: frequencyType === 'interval' ? intervalDays : null,
                  customDays: frequencyType === 'custom_days' ? customDays : [],
                  timeMinute: hours * 60 + minutes,
                  durationMinutes,
                });
                onClose();
              } finally {
                setBusy(false);
              }
            }}>
            {busy ? (mode === 'edit' ? 'Saving...' : 'Adding...') : mode === 'edit' ? 'Save Habit' : 'Add Habit'}
          </button>
        </div>
      </div>
    </div>
  );
}
