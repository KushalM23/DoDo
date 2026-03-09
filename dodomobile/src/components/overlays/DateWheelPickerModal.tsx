import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {fontSize, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {
  type CalendarMonthWheelItem,
  type TaskDateWheelItem,
  buildCalendarMonthItems,
  buildTaskDateItems,
  findCalendarMonthIndex,
  findTaskDateIndex,
  startOfLocalDay,
} from './dateWheelPickerUtils';
import {WheelColumn} from './WheelColumn';

type TaskDatePickerProps = {
  mode: 'task-date';
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
};

type CalendarMonthPickerProps = {
  mode: 'calendar-month';
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (value: {month: number; year: number}) => void;
};

type DateWheelPickerModalProps = TaskDatePickerProps | CalendarMonthPickerProps;

export function DateWheelPickerModal(props: DateWheelPickerModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterTranslateY = useRef(new Animated.Value(18)).current;

  const [taskTempDate, setTaskTempDate] = useState(() => startOfLocalDay(props.value));
  const [taskDateItems, setTaskDateItems] = useState<TaskDateWheelItem[]>(() =>
    buildTaskDateItems(startOfLocalDay(props.value)),
  );
  const taskSelectedIndex = useMemo(
    () => findTaskDateIndex(taskDateItems, taskTempDate),
    [taskDateItems, taskTempDate],
  );

  const [calendarTempDate, setCalendarTempDate] = useState(
    () => new Date(props.value.getFullYear(), props.value.getMonth(), 1),
  );
  const [calendarMonthItems, setCalendarMonthItems] = useState<CalendarMonthWheelItem[]>(() =>
    buildCalendarMonthItems(new Date(props.value.getFullYear(), props.value.getMonth(), 1)),
  );
  const calendarSelectedIndex = useMemo(
    () => findCalendarMonthIndex(calendarMonthItems, calendarTempDate),
    [calendarMonthItems, calendarTempDate],
  );

  useEffect(() => {
    if (!props.visible) {
      return;
    }

    const nextValue = startOfLocalDay(props.value);
    setTaskTempDate(nextValue);
    setTaskDateItems(buildTaskDateItems(nextValue));

    const nextCalendarDate = new Date(nextValue.getFullYear(), nextValue.getMonth(), 1);
    setCalendarTempDate(nextCalendarDate);
    setCalendarMonthItems(buildCalendarMonthItems(nextCalendarDate));
  }, [props.value, props.visible]);

  useEffect(() => {
    if (!props.visible) {
      enterOpacity.setValue(0);
      enterTranslateY.setValue(18);
      return;
    }

    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(enterTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [enterOpacity, enterTranslateY, props.visible]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={props.visible}
      onRequestClose={props.onClose}>
      <Pressable style={styles.overlay} onPress={props.onClose}>
        <Animated.View
          style={[
            styles.popup,
            {
              opacity: enterOpacity,
              transform: [{translateY: enterTranslateY}],
            },
          ]}>
          <Pressable onPress={() => {}}>

            <View style={styles.wheelWrap}>
              {props.mode === 'task-date' ? (
                <WheelColumn
                  items={taskDateItems.map(item => item.label)}
                  selectedIndex={taskSelectedIndex}
                  onSelectedIndexChange={index => setTaskTempDate(taskDateItems[index].date)}
                  isActive={props.visible}
                  width="100%"
                  testID="task-date-wheel"
                />
              ) : (
                <WheelColumn
                  items={calendarMonthItems.map(item => item.label)}
                  selectedIndex={calendarSelectedIndex}
                  onSelectedIndexChange={index =>
                    setCalendarTempDate(calendarMonthItems[index].date)
                  }
                  isActive={props.visible}
                  width="100%"
                  testID="calendar-month-wheel"
                />
              )}
            </View>

            <Pressable
              style={styles.confirmButton}
              onPress={() => {
                if (props.mode === 'task-date') {
                  props.onConfirm(taskTempDate);
                  return;
                }

                props.onConfirm({
                  month: calendarTempDate.getMonth(),
                  year: calendarTempDate.getFullYear(),
                });
              }}>
              <Text style={styles.confirmText}>Save</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
    popup: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 24,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.heading,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    wheelWrap: {
      width: '100%',
      backgroundColor: colors.surfaceLight,
      borderRadius: 24,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    confirmButton: {
      backgroundColor: colors.accent,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      marginTop: spacing.xs,
    },
    confirmText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
    },
  });