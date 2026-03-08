import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {spacing, fontSize} from '../theme/colors';
import {type ThemeColors, useThemeColors} from '../theme/ThemeProvider';
import type {TimeFormatPreference} from '../state/PreferencesContext';
import {fonts} from '../theme/fonts';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  timeFormat?: TimeFormatPreference;
};

export function CustomTimePicker({
  value,
  onChange,
  timeFormat = '12h',
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hourInput, setHourInput] = useState('12');
  const [minuteInput, setMinuteInput] = useState('00');

  const hours24 = value.getHours();
  const minutes = value.getMinutes();
  const isPM = hours24 >= 12;

  useEffect(() => {
    if (timeFormat === '24h') {
      setHourInput(String(hours24).padStart(2, '0'));
    } else {
      const hours12 = hours24 % 12 || 12;
      setHourInput(String(hours12).padStart(2, '0'));
    }
    setMinuteInput(String(minutes).padStart(2, '0'));
  }, [hours24, minutes, timeFormat]);

  function applyTimeFromInputs(
    nextHourText: string,
    nextMinuteText: string,
    nextIsPm: boolean,
  ) {
    const parsedHour = Number(nextHourText);
    const parsedMinute = Number(nextMinuteText);
    if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
      return;
    }

    const clampedMinute = Math.max(0, Math.min(59, Math.trunc(parsedMinute)));
    let hour24 = 0;
    if (timeFormat === '24h') {
      const clampedHour24 = Math.max(0, Math.min(23, Math.trunc(parsedHour)));
      hour24 = clampedHour24;
      setHourInput(String(clampedHour24).padStart(2, '0'));
    } else {
      const clampedHour12 = Math.max(1, Math.min(12, Math.trunc(parsedHour)));
      hour24 = (clampedHour12 % 12) + (nextIsPm ? 12 : 0);
      setHourInput(String(clampedHour12).padStart(2, '0'));
    }
    const next = new Date(value);
    next.setHours(hour24, clampedMinute, 0, 0);

    setMinuteInput(String(clampedMinute).padStart(2, '0'));
    onChange(next);
  }

  function toggleAmPm() {
    if (timeFormat === '24h') {
      return;
    }
    applyTimeFromInputs(hourInput, minuteInput, !isPM);
  }

  function applyHourInput(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '').slice(0, 2);
    setHourInput(clean);
    if (clean.length !== 2) {
      return;
    }
    applyTimeFromInputs(clean, minuteInput || '0', isPM);
  }

  function applyMinuteInput(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '').slice(0, 2);
    setMinuteInput(clean);
    if (clean.length !== 2) {
      return;
    }
    applyTimeFromInputs(
      hourInput || (timeFormat === '24h' ? '00' : '12'),
      clean,
      isPM,
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timeRow}>
        <View style={styles.timeInputWrap}>
          <TextInput
            style={styles.timeInput}
            value={hourInput}
            onChangeText={applyHourInput}
            onBlur={() =>
              applyTimeFromInputs(
                hourInput || (timeFormat === '24h' ? '00' : '12'),
                minuteInput || '0',
                isPM,
              )
            }
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
            placeholder={timeFormat === '24h' ? '00' : '12'}
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.timeColon}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={minuteInput}
            onChangeText={applyMinuteInput}
            onBlur={() =>
              applyTimeFromInputs(
                hourInput || (timeFormat === '24h' ? '00' : '12'),
                minuteInput || '0',
                isPM,
              )
            }
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
            placeholder="MM"
            placeholderTextColor={colors.mutedText}
          />
        </View>

        {timeFormat === '12h' && (
          <View style={styles.ampmGroup}>
            <Pressable
              onPress={() => isPM && toggleAmPm()}
              style={[styles.ampmBtn, !isPM && styles.ampmBtnActive]}>
              <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>
                AM
              </Text>
            </Pressable>
            <Pressable
              onPress={() => !isPM && toggleAmPm()}
              style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}>
              <Text style={[styles.ampmText, isPM && styles.ampmTextActive]}>
                PM
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 40,
      padding: spacing.lg,
      marginTop: spacing.sm,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timeInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    timeInput: {
      minWidth: 48,
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
      paddingVertical: spacing.xs,
    },
    timeColon: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
      marginHorizontal: spacing.xs,
    },
    ampmGroup: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 50,
      overflow: 'hidden',
    },
    ampmBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    ampmBtnActive: {
      backgroundColor: colors.accent,
    },
    ampmText: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    ampmTextActive: {
      color: colors.text,
    },
  });
