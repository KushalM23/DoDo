import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, View, InteractionManager} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {listTasksLocal} from '../../lib/local/repository';
import {runSync} from '../../lib/local/syncEngine';
import {useAuth} from '../../state/AuthContext';
import {useHabits} from '../../state/HabitsContext';
import {usePreferences} from '../../state/PreferencesContext';
import {spacing} from '../../theme/colors';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {habitAppliesToDate} from '../../utils/habits';
import type {Task} from '../../types/task';
import {
  monthWindow,
  taskStatusByDate,
  habitStatusByDate,
  localDateKey,
  toTaskEvent,
  toHabitEvent,
  TimelineEvent,
  buildMonthCells,
  resolveCalendarMonthSelection,
} from './utils';
import {CalendarGrid} from './CalendarGrid';
import {Timeline} from './Timeline';
import {BottomGradient} from '../../components/display/BottomGradient';
import {DateWheelPickerModal} from '../../components/overlays/DateWheelPickerModal';

export function CalendarScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {user} = useAuth();
  const {habits, completionMap, loadHistory} = useHabits();
  const {preferences} = usePreferences();

  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    localDateKey(today),
  );
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const [monthTasks, setMonthTasks] = useState<Task[]>([]);

  // Read from SQLite first, then reconcile after background sync.
  useEffect(() => {
    let canceled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let interactionHandle:
      | ReturnType<typeof InteractionManager.runAfterInteractions>
      | undefined;

    if (!user?.id) {
      setMonthTasks([]);
      return;
    }

    const {startAt, endAt} = monthWindow(currentDate);

    const loadMonthTasks = async () => {
      const localTasks = await listTasksLocal(user.id, {startAt, endAt});
      if (!canceled) {
        setMonthTasks(localTasks);
      }

      interactionHandle = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          void runSync(user.id, 'manual').then(async didSync => {
            if (!didSync || canceled) {
              return;
            }

            const reconciledTasks = await listTasksLocal(user.id, {
              startAt,
              endAt,
            });
            if (!canceled) {
              setMonthTasks(reconciledTasks);
            }
          });
        }, 100);
      });
    };

    void loadMonthTasks();

    return () => {
      canceled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      interactionHandle?.cancel();
    };
  }, [currentDate, user?.id]);

  const allMonthCells = useMemo(
    () => buildMonthCells(currentDate, preferences.weekStart),
    [currentDate, preferences.weekStart],
  );

  useEffect(() => {
    if (allMonthCells.length === 0) {
      return;
    }
    const startDate = allMonthCells[0].dateKey;
    const endDate = allMonthCells[allMonthCells.length - 1].dateKey;

    // Defer habit history load until animations finish
    const handle = InteractionManager.runAfterInteractions(() => {
      loadHistory({startDate, endDate}).catch(() => {});
    });

    return () => handle.cancel();
  }, [allMonthCells, loadHistory]);

  const statusMap = useMemo(() => taskStatusByDate(monthTasks), [monthTasks]);
  const habitStatusMap = useMemo(
    () =>
      habitStatusByDate(
        habits,
        allMonthCells.map(cell => cell.dateKey),
        completionMap,
      ),
    [habits, allMonthCells, completionMap],
  );

  const tasksForSelectedDate: TimelineEvent[] = useMemo(() => {
    const tTasks = monthTasks
      .filter(task => localDateKey(new Date(task.scheduledAt)) === selectedDate)
      .map(toTaskEvent);

    const hTasks = habits
      .filter(habit => habitAppliesToDate(habit, selectedDate))
      .map((habit, idx) => {
        const event = toHabitEvent(habit, selectedDate, idx);
        return {...event, completed: !!completionMap[habit.id]?.[selectedDate]};
      });

    return [...tTasks, ...hTasks];
  }, [monthTasks, habits, completionMap, selectedDate]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mainWrapper} pointerEvents="auto">
        <View style={styles.content}>
          <CalendarGrid
            mode={mode}
            setMode={setMode}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            statusMap={statusMap}
            habitStatusMap={habitStatusMap}
            onOpenMonthPicker={() => setIsMonthPickerOpen(true)}
          />
          <Timeline mode={mode} tasksForSelectedDate={tasksForSelectedDate} />
        </View>
      </View>

      {/* Bottom Gradient overlay */}
      <BottomGradient colors={colors} />

      <DateWheelPickerModal
        mode="calendar-month"
        visible={isMonthPickerOpen}
        value={currentDate}
        onClose={() => setIsMonthPickerOpen(false)}
        onConfirm={({month, year}) => {
          const nextSelection = resolveCalendarMonthSelection(month, year);
          setCurrentDate(nextSelection.currentDate);
          setSelectedDate(nextSelection.selectedDate);
          setIsMonthPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 24,
    },
    mainWrapper: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      paddingTop: 2,
      gap: 0,
    },
  });
