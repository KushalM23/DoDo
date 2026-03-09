import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {AppIcon} from '../../AppIcon';
import {spacing, fontSize} from '../../../theme/colors';
import {type ThemeColors, useThemeColors} from '../../../theme/ThemeProvider';
import type {WeekStartPreference} from '../../../state/PreferencesContext';
import {getCalendarOffset, getWeekdayInitials} from '../../../utils/dateTime';
import {fonts} from '../../../theme/fonts';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  weekStart?: WeekStartPreference;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function CustomDatePicker({
  value,
  onChange,
  weekStart = 'sunday',
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const selectedDay = value.getDate();
  const selectedMonth = value.getMonth();
  const selectedYear = value.getFullYear();

  const dayLabels = useMemo(() => getWeekdayInitials(weekStart), [weekStart]);

  const weeks = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getCalendarOffset(
      getFirstDayOfWeek(viewYear, viewMonth),
      weekStart,
    );
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [viewYear, viewMonth, weekStart]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  function selectDay(day: number) {
    const next = new Date(value);
    next.setFullYear(viewYear, viewMonth, day);
    onChange(next);
  }

  const isSelectedMonth =
    viewMonth === selectedMonth && viewYear === selectedYear;
  const today = new Date();
  const isTodayMonth =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthRow}>
        <Pressable
          onPress={prevMonth}
          hitSlop={12}
          style={styles.monthNavBtn}>
          <AppIcon name="chevron-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable
          onPress={nextMonth}
          hitSlop={12}
          style={styles.monthNavBtn}>
          <AppIcon name="chevron-right" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Day of week headers */}
      <View style={styles.weekRow}>
        {dayLabels.map((label, i) => (
          <View key={i} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day == null) {
              return <View key={`e${di}`} style={styles.dayCellWrapper} />;
            }
            const sel = isSelectedMonth && day === selectedDay;
            const isToday = isTodayMonth && day === today.getDate() && !sel;
            return (
              <View key={day} style={styles.dayCellWrapper}>
                <Pressable
                  style={[styles.dayCell, sel && styles.dayCellSelected]}
                  onPress={() => selectDay(day)}>
                  <Text
                    style={[
                      styles.dayText,
                      sel && styles.dayTextSelected,
                      isToday && styles.dayTextToday,
                    ]}>
                    {day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 24,
      padding: spacing.lg,
      marginTop: spacing.sm,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    monthNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      color: colors.text,
      fontSize: 28,
      fontFamily: fonts.heading,
      letterSpacing: -0.5,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    dayHeaderCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayHeaderText: {
      color: colors.mutedText,
      fontSize: 10,
      fontFamily: fonts.bodySemiBold,
      lineHeight: 13,
      textTransform: 'uppercase',
    },
    dayCellWrapper: {
      flex: 1,
      aspectRatio: 1,
      padding: 2,
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 50,
    },
    dayCellSelected: {
      backgroundColor: colors.text,
      shadowColor: 'rgba(0,0,0,0.4)',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 4,
    },
    dayText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodySemiBold,
    },
    dayTextSelected: {
      color: colors.background,
      fontFamily: fonts.bodyBold,
    },
    dayTextToday: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
  });
