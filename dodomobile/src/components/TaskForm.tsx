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
import {CustomDatePicker} from './CustomDatePicker';
import {CustomTimePicker} from './CustomTimePicker';
import {AppIcon} from './AppIcon';
import type {CreateTaskInput, Priority} from '../types/task';
import type {Category} from '../types/category';
import {spacing, radii, fontSize} from '../theme/colors';
import {
  type ThemeColors,
  useThemeColors,
  useThemeMode,
} from '../theme/ThemeProvider';
import {usePreferences} from '../state/PreferencesContext';
import {formatDate, formatTime} from '../utils/dateTime';
import {FormPopup, FormTab} from './FormPopup';
import {fonts} from '../theme/fonts';

type TaskFormProps = {
  visible: boolean;
  categories: Category[];
  defaultDate: string; // YYYY-MM-DD
  defaultCategoryId: string | null;
  mode?: 'create' | 'edit';
  initialValues?: Partial<CreateTaskInput>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
};

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

function roundToNextInterval(date: Date, intervalMinutes: number): Date {
  const next = new Date(date);
  const minutes = next.getMinutes();
  const remainder = minutes % intervalMinutes;
  const delta = remainder === 0 ? 0 : intervalMinutes - remainder;
  next.setMinutes(minutes + delta, 0, 0);
  return next;
}

export function TaskForm({
  visible,
  categories,
  defaultDate,
  defaultCategoryId,
  mode = 'create',
  initialValues,
  submitLabel,
  onCancel,
  onSubmit,
}: TaskFormProps) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {preferences} = usePreferences();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(2);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [durationCustom, setDurationCustom] = useState('60');
  const [durationUnit, setDurationUnit] = useState<'min' | 'hour'>('min');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    if (visible) {
      const editing = mode === 'edit' && !!initialValues;
      const initialDate =
        editing && initialValues?.scheduledAt
          ? new Date(initialValues.scheduledAt)
          : null;

      if (editing) {
        setTitle(initialValues?.title ?? '');
        setDescription(initialValues?.description ?? '');
        setPriority((initialValues?.priority as Priority | undefined) ?? 2);
        setScheduledAt(
          initialDate && !Number.isNaN(initialDate.getTime())
            ? initialDate
            : new Date(),
        );
        const nextDuration = initialValues?.durationMinutes ?? 60;
        setDurationMinutes(nextDuration);
        setDurationCustom(String(nextDuration));
        setDurationUnit('min');
        setCategoryId(initialValues?.categoryId ?? null);
      } else {
        setTitle('');
        setDescription('');
        setPriority(2);

        const [year, month, day] = defaultDate.split('-').map(Number);
        const dateIsValid =
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day);
        const nextDate = dateIsValid
          ? new Date(year, month - 1, day)
          : new Date();
        const roundedTime = roundToNextInterval(new Date(), 5);
        nextDate.setHours(
          roundedTime.getHours(),
          roundedTime.getMinutes(),
          0,
          0,
        );

        setScheduledAt(nextDate);
        setDurationMinutes(60);
        setDurationCustom('60');
        setDurationUnit('min');
        setCategoryId(defaultCategoryId);
      }
      setActiveTab('');
    }
  }, [visible, defaultCategoryId, defaultDate, initialValues, mode]);

  async function handleSubmit() {
    if (!title.trim()) return;
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      showAlert('Invalid duration', 'Duration must be at least 1 minute.');
      return;
    }
    setBusy(true);
    try {
      const deadline = new Date(
        scheduledAt.getTime() + durationMinutes * 60 * 1000,
      );

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        scheduledAt: scheduledAt.toISOString(),
        deadline: deadline.toISOString(),
        durationMinutes,
        priority,
      });
      onCancel();
    } catch (err) {
      showAlert(
        'Failed to create task',
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  function customToMinutes(raw: string, unit: 'min' | 'hour') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return durationMinutes;
    const base = unit === 'hour' ? parsed * 60 : parsed;
    return Math.max(1, Math.min(1440, Math.trunc(base)));
  }

  const priorityIcon = priority === 3 ? 'arrow-up-circle' : priority === 2 ? 'minus-circle' : 'arrow-down-circle';
  const durationLabel = `${durationMinutes} ${durationMinutes === 1 ? 'min' : 'mins'}`;
  
  const selectedCat = categories.find(c => c.id === categoryId);
  const categoryLabel = selectedCat?.name || 'Category';
  const categoryIcon = selectedCat?.icon || 'package';

  const tabs: FormTab[] = [
    {
      id: 'priority',
      icon: priorityIcon,
    },
    {
      id: 'date',
      icon: 'calendar',
      valueDisplay: formatDate(scheduledAt, preferences.dateFormat),
    },
    {
      id: 'time',
      icon: 'clock',
      valueDisplay: formatTime(scheduledAt, preferences.timeFormat),
    },
    {
      id: 'duration',
      icon: 'hourglass',
      valueDisplay: durationLabel,
    },
  ];

  if (categories.length > 0) {
    tabs.push({
      id: 'category',
      icon: categoryIcon as any,
      valueDisplay: categoryLabel,
    });
  }

  return (
    <FormPopup
      visible={visible}
      title={mode === 'edit' ? 'Edit Task' : 'New Task'}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      busy={busy}
      submitLabel={submitLabel ?? (mode === 'edit' ? 'Save' : 'Add')}
      nameValue={title}
      onNameChange={setTitle}
      namePlaceholder="Dodo's task"
      showNotes={false}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}>
      
      {activeTab === 'priority' && (
        <View>
          <Text style={styles.contentLabel}>Priority Level</Text>
          <View style={styles.wrapRow}>
            {([1, 2, 3] as Priority[]).map(p => {
              const active = priority === p;
              const col =
                p === 3
                  ? colors.highPriority
                  : p === 2
                  ? colors.mediumPriority
                  : colors.lowPriority;
              return (
                <Pressable
                  key={p}
                  style={[
                    styles.chipBtn,
                    active && {backgroundColor: col + '25', borderColor: col},
                  ]}
                  onPress={() => setPriority(p)}>
                  <AppIcon
                    name={
                      p === 3
                        ? 'arrow-up-circle'
                        : p === 2
                        ? 'minus-circle'
                        : 'arrow-down-circle'
                    }
                    size={18}
                    color={active ? col : colors.mutedText}
                  />
                  <Text style={[styles.chipBtnText, active && {color: col}]}>
                    {p === 1 ? 'Low' : p === 2 ? 'Medium' : 'High'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {activeTab === 'date' && (
        <View>
          <CustomDatePicker
            key={`task-form-picker-date-${themeMode}`}
            value={scheduledAt}
            onChange={setScheduledAt}
            weekStart={preferences.weekStart}
          />
        </View>
      )}

      {activeTab === 'time' && (
        <View>
          <CustomTimePicker
            key={`task-form-picker-time-${themeMode}`}
            value={scheduledAt}
            onChange={setScheduledAt}
            timeFormat={preferences.timeFormat}
          />
        </View>
      )}

      {activeTab === 'duration' && (
        <View>
          <Text style={styles.contentLabel}>Quick Select</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.durationRow}>
            {DURATION_OPTIONS.map(opt => {
              const active = durationMinutes === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.durationChip,
                    active && styles.durationChipActive,
                  ]}
                  onPress={() => {
                    setDurationMinutes(opt.value);
                    setDurationCustom(String(opt.value));
                    setDurationUnit('min');
                  }}>
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
          
          <Text style={[styles.contentLabel, {marginTop: spacing.md}]}>Custom Duration</Text>
          <View style={styles.customDurationRow}>
            <TextInput
              style={styles.customDurationInput}
              value={durationCustom}
              onChangeText={raw => {
                const clean = raw.replace(/[^0-9]/g, '').slice(0, 4);
                setDurationCustom(clean);
                if (clean.length === 0) return;
                setDurationMinutes(customToMinutes(clean, durationUnit));
              }}
              onBlur={() => {
                const normalized = customToMinutes(durationCustom, durationUnit);
                setDurationMinutes(normalized);
                const display =
                  durationUnit === 'hour'
                    ? Math.max(1, Math.round(normalized / 60))
                    : normalized;
                setDurationCustom(String(display));
              }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Custom"
              placeholderTextColor={colors.mutedText}
            />
            <View style={styles.unitToggleTrack}>
              <Pressable
                style={[
                  styles.unitToggleOption,
                  durationUnit === 'min' && styles.unitToggleOptionActive,
                ]}
                onPress={() => {
                  setDurationUnit('min');
                  setDurationCustom(String(durationMinutes));
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
                  setDurationUnit('hour');
                  setDurationCustom(
                    String(Math.max(1, Math.round(durationMinutes / 60))),
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

      {activeTab === 'category' && (
        <View>
          <Text style={styles.contentLabel}>Select Category</Text>
          <View style={styles.wrapRow}>
            {categories.map(cat => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setCategoryId(active ? null : cat.id)}>
                  <AppIcon 
                    name={cat.icon as any} 
                    size={16} 
                    color={active ? colors.accent : colors.mutedText} 
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      active && styles.catChipTextActive,
                    ]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </FormPopup>
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
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chipBtn: {
      flex: 1,
      minWidth: '30%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.surfaceLight,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    chipBtnText: {
      fontFamily: fonts.bodyBold,
      color: colors.mutedText,
      fontSize: fontSize.sm,
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
      paddingHorizontal: spacing.xl,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.md,
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
      paddingVertical: 10,
    },
    unitToggleOptionActive: {
      backgroundColor: colors.accentLight,
    },
    unitToggleText: {
      fontFamily: fonts.bodyMedium,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    unitToggleTextActive: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
    catChip: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 8,
    },
    catChipActive: {
      backgroundColor: colors.accentLight,
      borderColor: colors.accent,
    },
    catChipText: {
      fontFamily: fonts.bodyMedium,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    catChipTextActive: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
  });
