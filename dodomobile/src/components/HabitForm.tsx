import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAlert} from '../state/AlertContext';
import {AppIcon, AppIconName} from './AppIcon';
import {CustomTimePicker} from './CustomTimePicker';
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_OPTIONS,
  type CreateHabitInput,
  type Habit,
  type HabitFrequencyType,
  type HabitIcon,
} from '../types/habit';
import {fontSize, radii, spacing} from '../theme/colors';
import {
  type ThemeColors,
  useThemeColors,
  useThemeMode,
} from '../theme/ThemeProvider';
import {usePreferences} from '../state/PreferencesContext';
import {minuteToLabel} from '../utils/habits';
import {FormPopup, FormTab} from './FormPopup';
import {fonts} from '../theme/fonts';

type HabitFormProps = {
  visible: boolean;
  mode?: 'create' | 'edit';
  initialValues?: Habit;
  onCancel: () => void;
  onSubmit: (payload: CreateHabitInput) => Promise<void>;
};

const WEEK_DAYS = [
  {id: 0, label: 'Sun'},
  {id: 1, label: 'Mon'},
  {id: 2, label: 'Tue'},
  {id: 3, label: 'Wed'},
  {id: 4, label: 'Thu'},
  {id: 5, label: 'Fri'},
  {id: 6, label: 'Sat'},
];

function localDateKey(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function HabitForm({
  visible,
  mode = 'create',
  initialValues,
  onCancel,
  onSubmit,
}: HabitFormProps) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {preferences} = usePreferences();
  
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [intervalDays, setIntervalDays] = useState('2');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [timeValue, setTimeValue] = useState(new Date());
  const [durationValue, setDurationValue] = useState('60');
  const [durationUnit, setDurationUnit] = useState<'min' | 'hour'>('min');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  function customToMinutes(raw: string, unit: 'min' | 'hour') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 30;
    const base = unit === 'hour' ? parsed * 60 : parsed;
    return Math.max(1, Math.min(720, Math.trunc(base)));
  }

  useEffect(() => {
    if (!visible) return;

    const base = new Date();
    if (initialValues?.timeMinute != null) {
      base.setHours(
        Math.floor(initialValues.timeMinute / 60),
        initialValues.timeMinute % 60,
        0,
        0,
      );
    } else {
      base.setHours(9, 0, 0, 0);
    }

    setTitle(initialValues?.title ?? '');
    setIcon(initialValues?.icon ?? DEFAULT_HABIT_ICON);
    setFrequencyType(initialValues?.frequencyType ?? 'daily');
    setIntervalDays(String(initialValues?.intervalDays ?? 2));
    setCustomDays(initialValues?.customDays ?? []);
    setDurationValue(String(initialValues?.durationMinutes ?? 60));
    setDurationUnit('min');
    setTimeValue(base);
    setActiveTab('');
  }, [visible, initialValues]);

  function toggleCustomDay(day: number) {
    setCustomDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function handleSubmit() {
    if (!title.trim()) return;

    const parsedInterval = Math.max(
      2,
      Math.min(365, Number(intervalDays) || 2),
    );
    const parsedDuration = customToMinutes(durationValue, durationUnit);
    if (frequencyType === 'custom_days' && customDays.length === 0) {
      showAlert('Missing days', 'Choose at least one day for custom frequency.');
      return;
    }

    const minute = timeValue.getHours() * 60 + timeValue.getMinutes();

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        icon,
        anchorDate: localDateKey(new Date()),
        frequencyType,
        intervalDays: frequencyType === 'interval' ? parsedInterval : null,
        customDays: frequencyType === 'custom_days' ? customDays : [],
        timeMinute: minute,
        durationMinutes: parsedDuration,
      });
      onCancel();
    } catch (err) {
      showAlert(
        'Failed',
        err instanceof Error ? err.message : 'Unable to save habit.',
      );
    } finally {
      setBusy(false);
    }
  }

  let freqLabel = 'Every day';
  if (frequencyType === 'interval') freqLabel = `Every ${intervalDays} days`;
  if (frequencyType === 'custom_days') freqLabel = `${customDays.length} days/week`;

  const tabs: FormTab[] = [
    {
      id: 'icon',
      icon: icon as AppIconName,
    },
    {
      id: 'frequency',
      icon: 'repeat',
      valueDisplay: freqLabel,
    },
    {
      id: 'time',
      icon: 'clock',
      valueDisplay: minuteToLabel(
        timeValue.getHours() * 60 + timeValue.getMinutes(),
        preferences.timeFormat,
      ),
    },
    {
      id: 'duration',
      icon: 'hourglass',
      valueDisplay: `${durationValue} ${durationUnit === 'hour' ? 'hr' : 'min'}`,
    },
  ];

  return (
    <FormPopup
      visible={visible}
      title={mode === 'edit' ? 'Edit Habit' : 'New Habit'}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      busy={busy}
      submitLabel={mode === 'edit' ? 'Save' : 'Add'}
      nameValue={title}
      onNameChange={setTitle}
      namePlaceholder="Habit name"
      showNotes={false}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}>
      
      {activeTab === 'icon' && (
        <View style={styles.tabContentContainer}>
          <Text style={styles.contentLabel}>Select Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.iconRow}>
            {HABIT_ICON_OPTIONS.map(iconName => {
              const active = iconName === icon;
              return (
                <Pressable
                  key={iconName}
                  style={[styles.iconChip, active && styles.iconChipActive]}
                  onPress={() => setIcon(iconName)}>
                  <AppIcon
                    name={iconName as AppIconName}
                    size={24}
                    color={active ? colors.surface : colors.mutedText}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activeTab === 'frequency' && (
        <View style={styles.tabContentContainer}>
          <Text style={styles.contentLabel}>Frequency</Text>
          <View style={styles.wrapRow}>
            <Pressable
              style={[
                styles.chip,
                frequencyType === 'daily' && styles.chipActive,
              ]}
              onPress={() => setFrequencyType('daily')}>
              <Text
                style={[
                  styles.chipText,
                  frequencyType === 'daily' && styles.chipTextActive,
                ]}>
                Every day
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                frequencyType === 'interval' && styles.chipActive,
              ]}
              onPress={() => setFrequencyType('interval')}>
              <Text
                style={[
                  styles.chipText,
                  frequencyType === 'interval' && styles.chipTextActive,
                ]}>
                Every X days
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                frequencyType === 'custom_days' && styles.chipActive,
              ]}
              onPress={() => setFrequencyType('custom_days')}>
              <Text
                style={[
                  styles.chipText,
                  frequencyType === 'custom_days' && styles.chipTextActive,
                ]}>
                Custom days
              </Text>
            </Pressable>
          </View>

          {frequencyType === 'interval' && (
            <View style={styles.intervalRow}>
              <Text style={styles.intervalLabel}>Repeat every</Text>
              <TextInput
                style={styles.intervalInput}
                keyboardType="number-pad"
                value={intervalDays}
                onChangeText={raw =>
                  setIntervalDays(raw.replace(/[^0-9]/g, '').slice(0, 3))
                }
                placeholder="2"
                placeholderTextColor={colors.mutedText}
              />
              <Text style={styles.intervalLabel}>days</Text>
            </View>
          )}

          {frequencyType === 'custom_days' && (
            <View style={styles.daysGrid}>
              {WEEK_DAYS.map(day => {
                const active = customDays.includes(day.id);
                return (
                  <Pressable
                    key={day.id}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => toggleCustomDay(day.id)}>
                    <Text
                      style={[
                        styles.dayChipText,
                        active && styles.dayChipTextActive,
                      ]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {activeTab === 'time' && (
        <View style={styles.tabContentContainer}>
          <CustomTimePicker
            key={`habit-form-picker-${themeMode}`}
            value={timeValue}
            onChange={setTimeValue}
            timeFormat={preferences.timeFormat}
          />
        </View>
      )}

      {activeTab === 'duration' && (
        <View style={styles.tabContentContainer}>
          <Text style={styles.contentLabel}>Duration</Text>
          <View style={styles.customDurationRow}>
            <TextInput
              style={styles.customDurationInput}
              keyboardType="number-pad"
              value={durationValue}
              onChangeText={raw =>
                setDurationValue(raw.replace(/[^0-9]/g, '').slice(0, 3))
              }
              onBlur={() => {
                const normalized = customToMinutes(durationValue, durationUnit);
                const display =
                  durationUnit === 'hour'
                    ? Math.max(1, Math.round(normalized / 60))
                    : normalized;
                setDurationValue(String(display));
              }}
              placeholder="30"
              placeholderTextColor={colors.mutedText}
            />
            <View style={styles.unitToggleTrack}>
              <Pressable
                style={[
                  styles.unitToggleOption,
                  durationUnit === 'min' && styles.unitToggleOptionActive,
                ]}
                onPress={() => {
                  const currentMinutes = customToMinutes(durationValue, durationUnit);
                  setDurationUnit('min');
                  setDurationValue(String(currentMinutes));
                }}>
                <Text
                  style={[
                    styles.unitToggleText,
                    durationUnit === 'min' && styles.unitToggleTextActive,
                  ]}>
                  min
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.unitToggleOption,
                  durationUnit === 'hour' && styles.unitToggleOptionActive,
                ]}
                onPress={() => {
                  const currentMinutes = customToMinutes(durationValue, durationUnit);
                  setDurationUnit('hour');
                  setDurationValue(
                    String(Math.max(1, Math.round(currentMinutes / 60))),
                  );
                }}>
                <Text
                  style={[
                    styles.unitToggleText,
                    durationUnit === 'hour' && styles.unitToggleTextActive,
                  ]}>
                  hour
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </FormPopup>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabContentContainer: {
      flex: 1,
    },
    contentLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    iconRow: {
      gap: spacing.sm,
      paddingVertical: 8,
    },
    iconChip: {
      width: 52,
      height: 52,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChipActive: {
      borderColor: colors.habitBadge,
      backgroundColor: colors.habitBadge,
    },
    wrapRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    chip: {
      flex: 1,
      minWidth: '30%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
    },
    chipText: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyMedium,
      textAlign: 'center',
    },
    chipTextActive: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
    intervalRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.border,
    },
    intervalLabel: {
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.sm,
    },
    intervalInput: {
      width: 60,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 30,
      color: colors.text,
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      textAlign: 'center',
    },
    daysGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    dayChip: {
      width: '13.5%',
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      paddingVertical: spacing.xs,
    },
    dayChipActive: {
      borderColor: colors.habitBadge,
      backgroundColor: colors.habitBadgeLight,
    },
    dayChipText: {
      color: colors.mutedText,
      fontSize: fontSize.xs,
      fontFamily: fonts.bodyMedium,
    },
    dayChipTextActive: {
      color: colors.habitBadge,
      fontFamily: fonts.bodyBold,
    },
    customDurationRow: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    customDurationInput: {
      flex: 1,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
      color: colors.text,
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
    },
    unitToggleTrack: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 50,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    unitToggleOption: {
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    unitToggleOptionActive: {
      backgroundColor: colors.accentLight,
    },
    unitToggleText: {
      color: colors.mutedText,
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.sm,
    },
    unitToggleTextActive: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
  });
