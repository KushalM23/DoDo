import React, {useEffect, useMemo, useState} from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fetchTasksInRange} from '../../services/api';
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
} from './utils';
import {CalendarGrid} from './CalendarGrid';
import {Timeline} from './Timeline';
import {BottomGradient} from '../../components/display/BottomGradient';

export function CalendarScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {habits, completionMap, loadHistory} = useHabits();
  const {preferences} = usePreferences();
  const {width, height} = useWindowDimensions();
  const isLandscape = width > height;

  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    localDateKey(today),
  );

  const [monthTasks, setMonthTasks] = useState<Task[]>([]);

  // To cover the whole period (month tasks for status dots, etc)
  // Let's grab the window based on the currentDate's month
  useEffect(() => {
    let canceled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let interactionHandle: ReturnType<
      typeof InteractionManager.runAfterInteractions
    >;
    const {startAt, endAt} = monthWindow(currentDate);
    const cacheKey = `@dodo/cal_tasks_${startAt}_${endAt}`;

    const fetchLatest = async () => {
      try {
        const data = await fetchTasksInRange(startAt, endAt);
        if (!canceled) {
          setMonthTasks(data);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch (err) {
        // ignore
      }
    };

    // Load cache eagerly (no deferral) so data appears immediately
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !canceled) {
          setMonthTasks(JSON.parse(cached));
        }
      } catch (err) {
        // ignore
      }

      // Defer only the network refresh until animations finish
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          if (!canceled) {
            fetchLatest();
          }
        }, 100);
      });
    })();

    return () => {
      canceled = true;
      clearTimeout(timeoutId);
      interactionHandle?.cancel();
    };
  }, [currentDate]);

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
        {isLandscape ? (
          <View style={styles.landscapeContent}>
            <View
              style={[styles.landscapeLeft, {width: Math.floor(width * 0.45)}]}>
              <CalendarGrid
                mode={mode}
                setMode={setMode}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                statusMap={statusMap}
                habitStatusMap={habitStatusMap}
                isLandscape={true}
              />
            </View>
            <View style={styles.landscapeDivider} />
            <View style={styles.landscapeRight}>
              <Timeline
                mode={mode}
                isLandscape={true}
                tasksForSelectedDate={tasksForSelectedDate}
              />
            </View>
          </View>
        ) : (
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
              isLandscape={false}
            />
            <Timeline
              mode={mode}
              isLandscape={false}
              tasksForSelectedDate={tasksForSelectedDate}
            />
          </View>
        )}
      </View>

      {/* Bottom Gradient overlay */}
      <BottomGradient colors={colors} />
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
    landscapeContent: {
      flex: 1,
      flexDirection: 'row',
    },
    landscapeLeft: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      paddingTop: 2,
    },
    landscapeDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    landscapeRight: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      paddingTop: 2,
    },
  });
