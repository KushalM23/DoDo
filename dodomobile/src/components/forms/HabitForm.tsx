import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import {AppIcon, AppIconName} from '../AppIcon';
import {CustomTimePicker} from './pickers/CustomTimePicker';
import {CustomDurationPicker} from './pickers/CustomDurationPicker';
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_OPTIONS,
  type CreateHabitInput,
  type Habit,
  type HabitFrequencyType,
  type HabitIcon,
} from '../../types/habit';
import {fontSize, spacing} from '../../theme/colors';
import {
  type ThemeColors,
  useThemeColors,
  useThemeMode,
} from '../../theme/ThemeProvider';
import {usePreferences} from '../../state/PreferencesContext';
import {minuteToLabel} from '../../utils/habits';
import {FormPopup, FormTab} from './FormPopup';
import {fonts} from '../../theme/fonts';

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
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  function formatDurationSmart(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
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
    setDurationMinutes(initialValues?.durationMinutes ?? 60);
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
    const parsedDuration = durationMinutes;
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

  let freqLabel = 'Daily';
  if (frequencyType === 'interval') freqLabel = `${intervalDays} Days`;
  if (frequencyType === 'custom_days') freqLabel = `${customDays.length}/wk`;

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
      valueDisplay: minuteToLabel(
        timeValue.getHours() * 60 + timeValue.getMinutes(),
        preferences.timeFormat,
      ),
    },
    {
      id: 'duration',
      icon: 'hourglass',
      valueDisplay: formatDurationSmart(durationMinutes),
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
          <CustomDurationPicker value={durationMinutes} onChange={setDurationMinutes} />
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
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChipActive: {
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
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: colors.accent,
    },
    chipText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyMedium,
      textAlign: 'center',
    },
    chipTextActive: {
      color: colors.text,
      fontFamily: fonts.bodyBold,
    },
    intervalRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 50,
    },
    intervalLabel: {
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.sm,
    },
    intervalInput: {
      width: 60,
      backgroundColor: colors.surface,
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
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      paddingVertical: spacing.xs,
    },
    dayChipActive: {
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
  });
