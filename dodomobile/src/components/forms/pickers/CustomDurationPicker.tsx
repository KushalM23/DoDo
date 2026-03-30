import React, {useMemo, useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import {spacing, fontSize} from '../../../theme/colors';
import {ThemeColors, useThemeColors} from '../../../theme/ThemeProvider';
import {fonts} from '../../../theme/fonts';

const DURATION_OPTIONS = [
  {label: '15m', value: 15},
  {label: '30m', value: 30},
  {label: '45m', value: 45},
  {label: '1h', value: 60},
  {label: '2h', value: 120},
  {label: '3h', value: 180},
  {label: '4h', value: 240},
  {label: '5h', value: 300},
];

type CustomDurationPickerProps = {
  value: number; // in minutes
  onChange: (minutes: number) => void;
  showQuickSelect?: boolean;
};

export function CustomDurationPicker({
  value,
  onChange,
  showQuickSelect = true,
}: CustomDurationPickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [unit, setUnit] = useState<'min' | 'hour'>('min');
  const [customText, setCustomText] = useState(String(value));

  // Sync external value changes (e.g., when modal opens with new task/habit)
  useEffect(() => {
    if (value >= 60 && value % 60 === 0) {
      setUnit('hour');
      setCustomText(String(value / 60));
    } else {
      setUnit('min');
      setCustomText(String(value));
    }
  }, [value]);

  function customToMinutes(raw: string, u: 'min' | 'hour') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    const base = u === 'hour' ? parsed * 60 : parsed;
    return Math.max(1, Math.min(1440, Math.round(base)));
  }

  function handleQuickSelect(val: number) {
    onChange(val);
  }

  return (
    <View>
      {showQuickSelect && (
        <>
          <Text style={styles.contentLabel}>Quick Select</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.durationRow}>
            {DURATION_OPTIONS.map(opt => {
              const active = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.durationChip,
                    active && styles.durationChipActive,
                  ]}
                  onPress={() => handleQuickSelect(opt.value)}>
                  <Text
                    style={[
                      styles.durationText,
                      active && styles.durationTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.contentLabel, {marginTop: spacing.md}]}>
            Custom Duration
          </Text>
        </>
      )}
      {!showQuickSelect && <Text style={styles.contentLabel}>Duration</Text>}

      <View style={styles.customDurationRow}>
        <TextInput
          style={styles.customDurationInput}
          value={customText}
          onChangeText={raw => {
            const allowDecimal = unit === 'hour';
            const clean = allowDecimal
              ? raw
                  .replace(/[^0-9.]/g, '')
                  .replace(/(\..*)\./g, '$1')
                  .slice(0, 5)
              : raw.replace(/[^0-9]/g, '').slice(0, 4);
            setCustomText(clean);
            if (clean.length === 0) {
              return;
            }
            onChange(customToMinutes(clean, unit));
          }}
          onBlur={() => {
            const normalized = customToMinutes(customText, unit);
            onChange(normalized);
            const display =
              unit === 'hour'
                ? Math.max(1, Math.round(normalized / 60))
                : normalized;
            setCustomText(String(display));
          }}
          keyboardType={unit === 'hour' ? 'decimal-pad' : 'number-pad'}
          maxLength={5}
          placeholder="Custom"
          placeholderTextColor={colors.mutedText}
        />
        <View style={styles.unitToggleTrack}>
          <Pressable
            style={[
              styles.unitToggleOption,
              unit === 'min' && styles.unitToggleOptionActive,
            ]}
            onPress={() => {
              const currentMinutes = customToMinutes(customText, unit);
              setUnit('min');
              setCustomText(String(currentMinutes));
              onChange(currentMinutes);
            }}>
            <Text
              style={[
                styles.unitToggleText,
                unit === 'min' && styles.unitToggleTextActive,
              ]}>
              min
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.unitToggleOption,
              unit === 'hour' && styles.unitToggleOptionActive,
            ]}
            onPress={() => {
              const currentMinutes = customToMinutes(customText, unit);
              setUnit('hour');
              setCustomText(
                String(Math.max(1, Math.round(currentMinutes / 60))),
              );
              onChange(currentMinutes);
            }}>
            <Text
              style={[
                styles.unitToggleText,
                unit === 'hour' && styles.unitToggleTextActive,
              ]}>
              hour
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    contentLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    durationRow: {
      gap: spacing.sm,
      paddingVertical: 4,
      alignItems: 'flex-start',
    },
    durationChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
    },
    durationChipActive: {
      backgroundColor: colors.accent,
    },
    durationText: {
      fontFamily: fonts.bodyMedium,
      color: colors.text,
      fontSize: fontSize.sm,
    },
    durationTextActive: {
      color: colors.text,
      fontFamily: fonts.bodyBold,
    },
    customDurationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    customDurationInput: {
      flex: 1,
      backgroundColor: colors.surfaceLight,
      borderRadius: 50,
      paddingHorizontal: spacing.xl,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.md,
    },
    unitToggleTrack: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 50,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    unitToggleOption: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    unitToggleOptionActive: {
      backgroundColor: colors.accent,
    },
    unitToggleText: {
      fontFamily: fonts.bodyMedium,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    unitToggleTextActive: {
      color: colors.text,
      fontFamily: fonts.bodyBold,
    },
  });
