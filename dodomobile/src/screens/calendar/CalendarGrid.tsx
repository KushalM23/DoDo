import React, {useMemo, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  useWindowDimensions,
  Easing,
} from 'react-native';
import {unstable_batchedUpdates} from 'react-native';
import {spacing, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {useThemeColors, ThemeColors} from '../../theme/ThemeProvider';
import {getWeekdayLabels} from '../../utils/dateTime';
import {usePreferences} from '../../state/PreferencesContext';
import {
  buildMonthCells,
  CalendarCell,
  parseDateKey,
  localDateKey,
  shiftCalendarMonth,
} from './utils';
import {formatCalendarTriggerLabel} from '../../components/overlays/dateWheelPickerUtils';

// ── Memoized day cell to avoid re-rendering all 35-42 cells ──
const DayCell = React.memo(
  ({
    cell,
    isSelected,
    status,
    habitStatus,
    cellSize,
    onPress,
    styles,
    colors,
    mode,
  }: {
    cell: CalendarCell;
    isSelected: boolean;
    status: 'none' | 'partial' | 'done';
    habitStatus: 'none' | 'partial' | 'done';
    cellSize: number;
    onPress: (cell: CalendarCell) => void;
    styles: any;
    colors: any;
    mode: 'week' | 'month';
  }) => {
    if (mode === 'month' && !cell.inCurrentMonth) {
      return <View style={{width: cellSize, height: cellSize}} />;
    }

    return (
      <Pressable
        onPress={() => onPress(cell)}
        style={[
          styles.dayCell,
          {
            width: cellSize,
            height: cellSize,
            borderRadius: cellSize / 2,
          },
          isSelected && styles.daySelected,
        ]}>
        <View style={{alignItems: 'center', justifyContent: 'center'}}>
          <Text
            style={[
              styles.dayNum,
              {color: isSelected ? colors.text : colors.text},
              cell.isToday && !isSelected && styles.todayNum,
              isSelected && styles.selectedDayNum,
            ]}>
            {cell.dayNum}
          </Text>

          <View style={styles.indicatorRow}>
            {status !== 'none' && (
              <View
                style={[
                  styles.statusDot,
                  status === 'done' ? styles.doneDot : styles.partialDot,
                ]}
              />
            )}
            {habitStatus !== 'none' && (
              <View
                style={[
                  styles.statusDot,
                  habitStatus === 'done'
                    ? styles.habitDoneDot
                    : styles.habitPartialDot,
                ]}
              />
            )}
          </View>
        </View>
      </Pressable>
    );
  },
);

interface CalendarGridProps {
  mode: 'week' | 'month';
  setMode: (mode: 'week' | 'month') => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedDate: string;
  setSelectedDate: (dateKey: string) => void;
  statusMap: Record<string, 'none' | 'partial' | 'done'>;
  habitStatusMap: Record<string, 'none' | 'partial' | 'done'>;
  onOpenMonthPicker: () => void;
}

export function CalendarGrid({
  mode,
  setMode,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  statusMap,
  habitStatusMap,
  onOpenMonthPicker,
}: CalendarGridProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {preferences} = usePreferences();
  const {width} = useWindowDimensions();

  const SCREEN_WIDTH = width;
  const CELL_SIZE = Math.floor((SCREEN_WIDTH - spacing.lg * 2) / 7);

  const dayNames = useMemo(
    () => getWeekdayLabels(preferences.weekStart),
    [preferences.weekStart],
  );

  const stateRef = useRef({mode, currentDate, selectedDate});
  useEffect(() => {
    stateRef.current = {mode, currentDate, selectedDate};
  }, [mode, currentDate, selectedDate]);

  /**
   * Shift month by delta (-1 = previous, +1 = next).
   * All state is read from stateRef to avoid stale closures in panResponder.
   *
   * Selection rule:
   *  - If the target month is today's month & year → select today's date
   *  - Otherwise → select the 1st of that month
   */
  const shiftMonth = (delta: number) => {
    const nextSelection = shiftCalendarMonth(
      stateRef.current.currentDate,
      delta,
    );

    unstable_batchedUpdates(() => {
      setCurrentDate(nextSelection.currentDate);
      setSelectedDate(nextSelection.selectedDate);
    });
  };

  // Separate animated value for month crossfade transitions
  const monthTransitionAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const {dx, dy} = gestureState;
        return Math.abs(dx) > 10 || Math.abs(dy) > 10;
      },
      onPanResponderMove: () => {
        // No-op for dragging. We only process swipes on release.
      },
      onPanResponderRelease: (_, gestureState) => {
        const {dx, dy} = gestureState;
        const {mode: currentMode, selectedDate: currentSelDate} =
          stateRef.current;

        if (Math.abs(dy) > Math.abs(dx)) {
          // --- Vertical swipe: toggle week/month mode ---
          if (dy > 0 && currentMode === 'week') {
            setMode('month');
          } else if (dy < 0 && currentMode === 'month') {
            setMode('week');
            setCurrentDate(parseDateKey(currentSelDate));
          }
        } else {
          // --- Horizontal swipe: navigate months ---
          if (currentMode === 'week') {
            // No horizontal navigation in week mode
            return;
          }

          const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.15;

          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            // dx > 0 means swiped right → previous month (-1)
            // dx < 0 means swiped left  → next month (+1)
            const direction = dx > 0 ? -1 : 1;

            Animated.timing(monthTransitionAnim, {
              toValue: 0,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start(() => {
              shiftMonth(direction);
              Animated.timing(monthTransitionAnim, {
                toValue: 1,
                duration: 100,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }).start();
            });
          }
        }
      },
    }),
  ).current;

  // Always render the full month cells for continuous drawer effect
  const cells = useMemo(() => {
    return buildMonthCells(currentDate, preferences.weekStart);
  }, [currentDate, preferences.weekStart]);

  const currentRowIndex = useMemo(() => {
    const key = localDateKey(currentDate);
    const index = cells.findIndex(c => c.dateKey === key);
    return index >= 0 ? Math.floor(index / 7) : 0;
  }, [cells, currentDate]);

  const VERTICAL_PADDING_TOP = 6;
  const ROW_GAP = 14;
  const VERTICAL_PADDING_BOTTOM = 14;

  const numWeeks = Math.max(1, cells.length / 7);

  const heightAnim = useRef(
    new Animated.Value(
      mode === 'month'
        ? numWeeks * CELL_SIZE +
          Math.max(0, numWeeks - 1) * ROW_GAP +
          VERTICAL_PADDING_TOP +
          VERTICAL_PADDING_BOTTOM
        : CELL_SIZE + VERTICAL_PADDING_TOP + VERTICAL_PADDING_BOTTOM,
    ),
  ).current;

  const translateYAnim = useRef(
    new Animated.Value(
      mode === 'month'
        ? VERTICAL_PADDING_TOP
        : -currentRowIndex * (CELL_SIZE + ROW_GAP) + VERTICAL_PADDING_TOP,
    ),
  ).current;

  const prevMode = useRef(mode);
  const prevIndex = useRef(currentRowIndex);
  const prevWeeks = useRef(numWeeks);

  useEffect(() => {
    const modeChanged = prevMode.current !== mode;
    const indexChanged = prevIndex.current !== currentRowIndex;
    const weeksChanged = prevWeeks.current !== numWeeks;

    const targetHeight =
      mode === 'month'
        ? numWeeks * CELL_SIZE +
          Math.max(0, numWeeks - 1) * ROW_GAP +
          VERTICAL_PADDING_TOP +
          VERTICAL_PADDING_BOTTOM
        : CELL_SIZE + VERTICAL_PADDING_TOP + VERTICAL_PADDING_BOTTOM;

    const targetTranslateY =
      mode === 'month'
        ? VERTICAL_PADDING_TOP
        : -currentRowIndex * (CELL_SIZE + ROW_GAP) + VERTICAL_PADDING_TOP;

    // Instant update for horizontal swiping
    if (indexChanged && !modeChanged && !weeksChanged) {
      if (mode === 'week') {
        translateYAnim.setValue(targetTranslateY);
      }
    }

    if (modeChanged || weeksChanged) {
      // Animated.timing for the old "drawer" feel where the
      // selected week slides into position
      const duration = 350;
      const easing = Easing.bezier(0.25, 0.1, 0.25, 1);

      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: targetHeight,
          duration,
          easing,
          useNativeDriver: false,
        }),
        Animated.timing(translateYAnim, {
          toValue: targetTranslateY,
          duration,
          easing,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      heightAnim.setValue(targetHeight);
      translateYAnim.setValue(targetTranslateY);
    }

    prevMode.current = mode;
    prevIndex.current = currentRowIndex;
    prevWeeks.current = numWeeks;
  }, [mode, currentRowIndex, numWeeks, CELL_SIZE, heightAnim, translateYAnim]);

  const monthLabel = useMemo(
    () => formatCalendarTriggerLabel(currentDate),
    [currentDate],
  );

  // Calculate transition fade
  const fadeAnim = monthTransitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleSelectDate = useCallback(
    (cell: CalendarCell) => {
      setSelectedDate(cell.dateKey);
      setCurrentDate(cell.date);
    },
    [setSelectedDate, setCurrentDate],
  );

  return (
    <View style={styles.calendarSection} {...panResponder.panHandlers}>
      {/* Wrap month label + week headers + grid in the fade animation
          so everything fades together during month transitions. */}
      <Animated.View style={{opacity: fadeAnim}}>
        <View style={styles.monthControls}>
          <Pressable onPress={onOpenMonthPicker} hitSlop={12}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {dayNames.map((dayName, index) => (
            <View
              key={`${dayName}-${index}`}
              style={[styles.weekHeaderCell, {width: CELL_SIZE}]}>
              <Text style={styles.dayHeader}>{dayName}</Text>
            </View>
          ))}
        </View>

        <Animated.View style={[styles.gridViewport, {height: heightAnim}]}>
          <Animated.View
            style={[styles.grid, {transform: [{translateY: translateYAnim}]}]}>
            {cells.map(cell => {
              const status = statusMap[cell.dateKey] || 'none';
              const habitStatus = habitStatusMap[cell.dateKey] || 'none';
              const isSelected = cell.dateKey === selectedDate;

              return (
                <DayCell
                  key={cell.key}
                  cell={cell}
                  isSelected={isSelected}
                  status={status}
                  habitStatus={habitStatus}
                  cellSize={CELL_SIZE}
                  onPress={handleSelectDate}
                  styles={styles}
                  colors={colors}
                  mode={mode}
                />
              );
            })}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    calendarSection: {
      paddingTop: 0,
      marginBottom: 8,
    },
    monthControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    monthLabel: {
      fontSize: 36,
      fontFamily: fonts.heading,
      color: colors.text,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekHeaderCell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayHeader: {
      color: colors.mutedText,
      fontSize: 10,
      fontFamily: fonts.bodySemiBold,
      lineHeight: 13,
    },
    gridViewport: {
      overflow: 'hidden',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 14,
    },
    dayCell: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    daySelected: {
      backgroundColor: colors.text,
    },
    dayNum: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodySemiBold,
    },
    selectedDayNum: {
      fontFamily: fonts.bodyBold,
      color: colors.background,
    },
    todayNum: {
      color: colors.accent,
      fontFamily: fonts.bodyBold,
    },
    indicatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 2,
      height: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    doneDot: {
      backgroundColor: colors.accent,
    },
    partialDot: {
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: 'transparent',
    },
    habitDoneDot: {
      backgroundColor: colors.habitBadge,
    },
    habitPartialDot: {
      borderWidth: 2,
      borderColor: colors.habitBadge,
      backgroundColor: 'transparent',
    },
  });
