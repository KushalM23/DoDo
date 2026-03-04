import React from 'react';
import {View} from 'react-native';
import {CustomDatePicker} from './CustomDatePicker';
import {CustomTimePicker} from './CustomTimePicker';
import type {
  TimeFormatPreference,
  WeekStartPreference,
} from '../state/PreferencesContext';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  timeFormat?: TimeFormatPreference;
  weekStart?: WeekStartPreference;
  mode?: 'datetime' | 'date' | 'time';
};

/**
 * Composite picker that renders a date picker and/or time picker.
 * Kept for backward compatibility — prefer using CustomDatePicker
 * and CustomTimePicker directly in new code.
 */
export function CustomDateTimePicker({
  value,
  onChange,
  timeFormat = '12h',
  weekStart = 'sunday',
  mode = 'datetime',
}: Props) {
  const showCalendar = mode === 'datetime' || mode === 'date';
  const showTime = mode === 'datetime' || mode === 'time';

  return (
    <View>
      {showCalendar && (
        <CustomDatePicker
          value={value}
          onChange={onChange}
          weekStart={weekStart}
        />
      )}
      {showTime && (
        <CustomTimePicker
          value={value}
          onChange={onChange}
          timeFormat={timeFormat}
        />
      )}
    </View>
  );
}
