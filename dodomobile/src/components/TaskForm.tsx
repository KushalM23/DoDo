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
import {CustomDurationPicker} from './CustomDurationPicker';
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

  function formatDurationSmart(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  }

  const durationLabel = formatDurationSmart(durationMinutes);
  
  const selectedCat = categories.find(c => c.id === categoryId);
  const categoryIcon = selectedCat?.icon || 'package';
  const categoryColor = selectedCat?.color;
  const priorityColor =
    priority === 3
      ? colors.highPriority
      : priority === 2
      ? colors.mediumPriority
      : colors.lowPriority;

  const tabsTop: FormTab[] = [
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
  ];

  const tabsBottom: FormTab[] = [
    {
      id: 'priority',
      icon: priority === 3 ? 'arrow-up-circle' : priority === 2 ? 'minus-circle' : 'arrow-down-circle',
      color: priorityColor,
      valueDisplay: priority === 3 ? 'High' : priority === 2 ? 'Med' : 'Low',
    },
    {
      id: 'duration',
      icon: 'hourglass',
      valueDisplay: durationLabel,
    },
  ];

  if (categories.length > 0) {
    tabsBottom.push({
      id: 'category',
      icon: categoryIcon as any,
      color: categoryColor,
      valueDisplay: selectedCat?.name || 'Category',
    });
  }

  const tabs: FormTab[][] = [tabsTop, tabsBottom];

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
                    active && {backgroundColor: col}
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
                    color={active ? '#fff' : colors.mutedText}
                  />
                  <Text style={[styles.chipBtnText, active && {color: '#fff'}]}>
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
        <View style={{paddingBottom: spacing.sm}}>
          <CustomDurationPicker value={durationMinutes} onChange={setDurationMinutes} />
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
                  style={[styles.catChip, active && {backgroundColor: cat.color}]}
                  onPress={() => setCategoryId(active ? null : cat.id)}>
                  <AppIcon 
                    name={cat.icon as any} 
                    size={16} 
                    color={active ? '#fff' : colors.mutedText} 
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      active && {color: '#fff', fontFamily: fonts.bodyBold},
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
      borderRadius: 50,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.surfaceLight,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    chipBtnText: {
      fontFamily: fonts.bodyBold,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
    catChip: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 50,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      gap: 8,
    },
    catChipText: {
      fontFamily: fonts.bodyMedium,
      color: colors.mutedText,
      fontSize: fontSize.sm,
    },
  });
