/**
 * TasksScreen — Multi-Page Object-Based Layout
 *
 * Page 0: Day Overview — all tasks & habits for the day
 * Page 1..N: One page per category — filtered tasks
 *
 * Swipe left/right to navigate between pages.
 * Page indicator dots at bottom.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTasks} from '../../state/TasksContext';
import {useHabits} from '../../state/HabitsContext';
import {useCategories} from '../../state/CategoriesContext';
import {useAlert} from '../../state/AlertContext';
import {TaskForm} from '../../components/TaskForm';
import {ManageCategoriesModal} from '../../components/ManageCategoriesModal';
import {BottomGradient} from '../../components/BottomGradient';
import {AppIcon, type AppIconName} from '../../components/AppIcon';
import {sortTasks} from '../../utils/taskSort';
import {habitAppliesToDate, minuteToIso} from '../../utils/habits';
import {spacing, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import type {CreateTaskInput, Task} from '../../types/task';
import type {Habit} from '../../types/habit';
import type {Category} from '../../types/category';
import type {RootStackParamList} from '../../navigation/RootNavigator';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

/* ─── helpers ─────────────────────────────────────────────── */

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}
function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}
function isSameDay(iso: string, dateStr: string): boolean {
  return toLocalDateStr(iso) === dateStr;
}
function habitToTask(
  h: Habit,
  dateStr: string,
  completed: boolean,
): Task & {_isHabit: true; _habitId: string; _habitIcon: Habit['icon']} {
  const minute = h.timeMinute ?? 9 * 60;
  const dur = h.durationMinutes ?? 30;
  return {
    id: `habit_${h.id}_${dateStr}`,
    _isHabit: true,
    _habitId: h.id,
    _habitIcon: h.icon,
    title: h.title,
    description: '',
    categoryId: null,
    scheduledAt: minuteToIso(dateStr, minute),
    deadline: minuteToIso(dateStr, Math.min(1439, minute + dur)),
    durationMinutes: dur,
    priority: 2,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    timerStartedAt: null,
    actualDurationMinutes: 0,
    completionXp: 0,
    createdAt: h.createdAt,
  };
}

type DisplayTask = Task & {
  _isHabit?: boolean;
  _habitId?: string;
  _habitIcon?: Habit['icon'];
};

function formatHeroDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  const dayName = DAY_NAMES[dateObj.getDay()];
  const monthName = MONTH_NAMES[dateObj.getMonth()];

  let ordStr = 'th';
  if (d === 1 || d === 21 || d === 31) {
    ordStr = 'st';
  } else if (d === 2 || d === 22) {
    ordStr = 'nd';
  } else if (d === 3 || d === 23) {
    ordStr = 'rd';
  }

  return `${dayName.substring(0, 3)}, ${d}${ordStr} ${monthName}`;
}

function formatTaskTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  h = h ? h : 12;
  const minStr = m < 10 ? '0' + m : m;
  return `${h}:${minStr} ${ampm}`;
}

/** Format duration: 60+ minutes → hours format */
function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) {
    return null;
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const hourStr = hours === 1 ? '1 hour' : `${hours} hours`;
  if (remaining === 0) {
    return hourStr;
  }
  return `${hourStr} ${remaining} min`;
}

function priorityColor(priority: number, colors: ThemeColors): string {
  if (priority === 3) {
    return colors.highPriority;
  }
  if (priority === 2) {
    return colors.mediumPriority;
  }
  return colors.lowPriority;
}

function priorityIcon(priority: number): AppIconName {
  if (priority === 3) {
    return 'arrow-up-circle';
  }
  if (priority === 2) {
    return 'minus-circle';
  }
  return 'arrow-down-circle';
}

/* ─── Task slab (object) ───────────────────────────────────── */

function TaskSlab({
  task,
  onToggle,
  onPress,
  categories,
}: {
  task: DisplayTask;
  onToggle: (t: DisplayTask) => void;
  onPress: (t: DisplayTask) => void;
  categories: Category[];
}) {
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: false,
      speed: 40,
    }).start();
  }
  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
  }

  // Determine the leading icon (replaces checkmark)
  let leadingIconName: AppIconName;
  let leadingIconColor: string;

  if (task._isHabit && task._habitIcon) {
    leadingIconName = task._habitIcon as AppIconName;
    leadingIconColor = colors.habitBadge;
  } else {
    const cat = categories.find(c => c.id === task.categoryId);
    if (cat) {
      leadingIconName = cat.icon as AppIconName;
      leadingIconColor = cat.color;
    } else {
      leadingIconName = 'check-circle';
      leadingIconColor = colors.accent;
    }
  }

  // Determine the right-side indicator
  let rightIcon: AppIconName;
  let rightIconColor: string;

  if (task._isHabit) {
    rightIcon = 'repeat' as AppIconName;
    rightIconColor = colors.habitBadge;
  } else {
    rightIcon = priorityIcon(task.priority);
    rightIconColor = priorityColor(task.priority, colors);
  }

  const durationStr = formatDuration(task.durationMinutes);

  return (
    <Animated.View
      style={{
        transform: [{scale: scaleAnim}],
        marginBottom: 4,
        paddingVertical: 18,
        paddingHorizontal: 4,
        opacity: task.completed ? 0.5 : 1,
      }}>
      <Pressable
        style={{flexDirection: 'row', alignItems: 'center', gap: 14}}
        onPress={() => onPress(task)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}>
        {/* Leading icon — acts as checkmark toggle */}
        <Pressable
          onPress={() => onToggle(task)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppIcon
            name={task.completed ? 'check' : leadingIconName}
            size={24}
            color={task.completed ? leadingIconColor : leadingIconColor}
          />
        </Pressable>

        {/* Text */}
        <View style={{flex: 1}}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 22,
              fontFamily: fonts.headingSemiBold,
              letterSpacing: 0.4,
              color: task.completed ? colors.mutedText : colors.text,
              textDecorationLine: task.completed ? 'line-through' : 'none',
            }}>
            {task.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.mutedText,
              marginTop: 5,
              fontFamily: fonts.bodyMedium,
              textDecorationLine: task.completed ? 'line-through' : 'none',
            }}>
            {formatTaskTime(task.scheduledAt)}
            {durationStr ? ` • ${durationStr}` : null}
          </Text>
        </View>

        {/* Priority or habit badge */}
        <View style={{padding: 6}}>
          <AppIcon name={rightIcon} size={16} color={rightIconColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ─── Page indicator dots ──────────────────────────────────── */

function PageDots({
  count,
  scrollX,
  colors,
}: {
  count: number;
  scrollX: Animated.Value;
  colors: ThemeColors;
}) {
  if (count <= 1) {
    return null;
  }

  const dotSize = 8;
  const dotGap = 16;
  const pillWidth = 20;
  const step = dotSize + dotGap; // 16

  const inputRange: number[] = [];
  const leftOutput: number[] = [];
  const widthOutput: number[] = [];

  for (let i = 0; i < count; i++) {
    inputRange.push(i * SCREEN_WIDTH);
    leftOutput.push(i * step - (pillWidth - dotSize) / 2);
    widthOutput.push(pillWidth);

    if (i < count - 1) {
      inputRange.push((i + 0.5) * SCREEN_WIDTH);
      leftOutput.push(i * step - (pillWidth - dotSize) / 2);
      widthOutput.push(pillWidth + step);
    }
  }

  const indicatorLeft = scrollX.interpolate({
    inputRange,
    outputRange: leftOutput,
    extrapolate: 'clamp',
  });

  const indicatorWidth = scrollX.interpolate({
    inputRange,
    outputRange: widthOutput,
    extrapolate: 'clamp',
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 12,
      }}>
      <View style={{flexDirection: 'row', gap: dotGap}}>
        {Array.from({length: count}).map((_, i) => (
          <View
            key={`dot-${i}`}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: colors.surfaceLight,
            }}
          />
        ))}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: colors.accent,
            width: indicatorWidth,
            transform: [{translateX: indicatorLeft}],
          }}
        />
      </View>
    </View>
  );
}

/* ─── Single page content ──────────────────────────────────── */

function TaskPage({
  index,
  scrollX,
  heading,
  tasks,
  completedTasks,
  onToggle,
  onPress,
  categories,
  loading,
  onRefresh,
  onManageCategories,
  colors,
}: {
  index: number;
  scrollX: Animated.Value;
  heading: string;
  tasks: DisplayTask[];
  completedTasks: Task[];
  onToggle: (t: DisplayTask) => void;
  onPress: (t: DisplayTask) => void;
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
  onManageCategories?: () => void;
  colors: ThemeColors;
}) {
  const done = completedTasks.length;
  const total = tasks.length + done;
  const progress = total > 0 ? done / total : 0;

  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.95, 1, 0.95],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{width: SCREEN_WIDTH, transform: [{scale}], opacity, marginBottom: 100}}>
      <FlatList
        data={[...tasks, ...completedTasks]}
        keyExtractor={t => t.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 28,
          paddingTop: 24,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{paddingBottom: 16, paddingTop: 8, gap: 8}}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
              <Text
                style={{
                  fontSize: 38,
                  alignSelf: 'center',
                  textTransform: 'capitalize',
                  fontFamily: fonts.heading,
                  color: colors.text,
                  letterSpacing: -0.5,
                  marginBottom: 10,
                }}>
                {heading}
              </Text>
              {index !== 0 && onManageCategories && (
                <Pressable
                  onPress={onManageCategories}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 10,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <AppIcon name="package" size={24} color={colors.accent} />
                </Pressable>
              )}
            </View>

            {total > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 4,
                }}>
                <View
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.surfaceLight,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: colors.accent,
                      borderRadius: 3,
                      width: `${Math.round(progress * 100)}%`,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: fonts.bodyBold,
                    color: colors.mutedText,
                    letterSpacing: 0.2,
                  }}>
                  {done}/{total} done
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({item}) => (
          <TaskSlab
            task={item as DisplayTask}
            onToggle={onToggle}
            onPress={onPress}
            categories={categories}
          />
        )}
        ListEmptyComponent={
          <View style={{alignItems: 'center', paddingTop: 40, gap: 6}}>
            <Text
              style={{
                fontSize: 22,
                fontFamily: fonts.bodyBold,
                color: colors.text,
                letterSpacing: -0.5,
              }}>
              Nothing here.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.mutedText,
                fontFamily: fonts.bodyMedium,
              }}>
              Full clear!
            </Text>
          </View>
        }
      />
    </Animated.View>
  );
}

/* ─── Main screen ──────────────────────────────────────────── */

export function TasksScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {tasks, loading, refresh, addTask, toggleTaskCompletion} = useTasks();
  const {habits, loadHistory, isHabitCompletedOn, setHabitCompletedOn} =
    useHabits();
  const {categories} = useCategories();
  const [formVisible, setFormVisible] = useState(false);
  const [manageCategoriesVisible, setManageCategoriesVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [activePage, setActivePage] = useState(0);

  // FAB animations
  const addBtnScale = useRef(new Animated.Value(1)).current;
  const pageScrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isTodaySelected = selectedDate === todayStr();

  useEffect(() => {
    void loadHistory({startDate: selectedDate, endDate: selectedDate}).catch(
      () => {},
    );
  }, [selectedDate, loadHistory]);

  const allFilteredTasks = useMemo(() => {
    const dateTasks = tasks.filter(
      t => !t.completed && isSameDay(t.scheduledAt, selectedDate),
    );
    const habitTasks: DisplayTask[] = isTodaySelected
      ? habits
          .filter(h => habitAppliesToDate(h, selectedDate))
          .filter(h => !isHabitCompletedOn(h.id, selectedDate))
          .map(h => habitToTask(h, selectedDate, false))
      : [];
    return sortTasks([...dateTasks, ...habitTasks], 'time_asc');
  }, [tasks, habits, selectedDate, isHabitCompletedOn, isTodaySelected]);

  const completedTasks = useMemo(() => {
    const compTasks = tasks.filter(
      t => t.completed && isSameDay(t.scheduledAt, selectedDate),
    );
    const compHabits: DisplayTask[] = isTodaySelected
      ? habits
          .filter(h => habitAppliesToDate(h, selectedDate))
          .filter(h => isHabitCompletedOn(h.id, selectedDate))
          .map(h => habitToTask(h, selectedDate, true))
      : [];
    return sortTasks([...compTasks, ...compHabits], 'time_asc');
  }, [tasks, habits, selectedDate, isHabitCompletedOn, isTodaySelected]);

  // Build pages: [overview, ...categories]
  const pages = useMemo(() => {
    const overviewPage = {
      key: 'overview',
      heading: formatHeroDate(selectedDate),
      tasks: allFilteredTasks,
      completed: completedTasks,
    };

    const categoryPages = categories.map(cat => ({
      key: cat.id,
      heading: cat.name,
      tasks: allFilteredTasks.filter(t => t.categoryId === cat.id),
      completed: completedTasks.filter(t => t.categoryId === cat.id),
    }));

    return [overviewPage, ...categoryPages];
  }, [allFilteredTasks, completedTasks, categories, selectedDate]);

  async function handleCreateTask(input: CreateTaskInput) {
    await addTask(input);
  }

  function handleToggle(task: DisplayTask) {
    if (task._isHabit) {
      if (!isTodaySelected) {
        return;
      }
      void setHabitCompletedOn(
        task._habitId!,
        selectedDate,
        !task.completed,
      ).catch(() => {});
      return;
    }
    void toggleTaskCompletion(task).catch(() => {});
  }

  function handlePress(task: DisplayTask) {
    if (task._isHabit && task._habitId) {
      navigation.navigate('HabitDetail', {habitId: task._habitId});
    } else {
      navigation.navigate('TaskDetail', {taskId: task.id});
    }
  }

  function handlePageScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = e.nativeEvent.contentOffset.x;
    const page = Math.round(offset / SCREEN_WIDTH);
    if (page !== activePage) {
      setActivePage(page);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Horizontal page scroller */}
      <Animated.ScrollView
        ref={pageScrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {x: scrollX}}}],
          {useNativeDriver: false},
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handlePageScroll}
        style={{flex: 1}}
        decelerationRate="fast">
        {pages.map((page, index) => (
          <TaskPage
            key={page.key}
            index={index}
            scrollX={scrollX}
            heading={page.heading}
            tasks={page.tasks}
            completedTasks={page.completed}
            onToggle={handleToggle}
            onPress={handlePress}
            categories={categories}
            loading={loading}
            onRefresh={() => void refresh(selectedDate)}
            onManageCategories={() => setManageCategoriesVisible(true)}
            colors={colors}
          />
        ))}
      </Animated.ScrollView>

      {/* Bottom Gradient overlay */}
      <BottomGradient colors={colors} />

      {/* Page indicator dots */}
      <View style={styles.dotsContainer}>
        <PageDots count={pages.length} scrollX={scrollX} colors={colors} />
      </View>

      {/* Floating Add Button (Right) */}
      <Animated.View
        style={[styles.fabContainer, {transform: [{scale: addBtnScale}]}]}>
        <Pressable
          style={styles.fab}
          onPress={() => setFormVisible(true)}
          onPressIn={() =>
            Animated.spring(addBtnScale, {
              toValue: 0.9,
              useNativeDriver: true,
              speed: 40,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(addBtnScale, {
              toValue: 1,
              useNativeDriver: true,
              speed: 20,
            }).start()
          }>
          <AppIcon name="plus" size={32} color="#fff" />
        </Pressable>
      </Animated.View>

      <TaskForm
        visible={formVisible}
        categories={categories}
        defaultDate={selectedDate}
        defaultCategoryId={null}
        onCancel={() => setFormVisible(false)}
        onSubmit={handleCreateTask}
      />

      <ManageCategoriesModal
        visible={manageCategoriesVisible}
        onClose={() => setManageCategoriesVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dotsContainer: {
      position: 'absolute',
      bottom: 96,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 20,
    },
    fabContainer: {
      position: 'absolute',
      bottom: 100,
      right: 48,
      zIndex: 100,
    },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
