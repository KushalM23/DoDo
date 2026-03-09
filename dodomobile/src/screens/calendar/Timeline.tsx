import React, {useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import {formatTime} from '../../utils/dateTime';
import {usePreferences} from '../../state/PreferencesContext';
import {useThemeColors, ThemeColors} from '../../theme/ThemeProvider';
import {fonts} from '../../theme/fonts';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {
  DAY_MINUTES,
  AXIS_HEIGHT,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
  BASE_PX_PER_MINUTE,
  MIN_PX_PER_MINUTE,
  MAX_PX_PER_MINUTE,
  RowPlacedTimelineEvent,
  TimelineEvent,
  layoutEventsIntoRows,
  layoutVerticalEventsIntoColumns,
} from './utils';

interface TimelineProps {
  mode: 'week' | 'month';
  isLandscape: boolean;
  tasksForSelectedDate: TimelineEvent[];
}

function touchDistance(event: GestureResponderEvent): number {
  if (event.nativeEvent.touches.length < 2) {
    return 0;
  }
  const [a, b] = event.nativeEvent.touches;
  const dx = b.pageX - a.pageX;
  const dy = b.pageY - a.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function Timeline({
  mode,
  isLandscape,
  tasksForSelectedDate,
}: TimelineProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {preferences} = usePreferences();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isVertical = mode === 'week';

  const [timelineHeight, setTimelineHeight] = useState(240);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [pxPerMinute, setPxPerMinute] = useState(BASE_PX_PER_MINUTE);

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetRef = useRef(0);
  const pinchStartDistanceRef = useRef(0);
  const pinchAppliedScaleRef = useRef(BASE_PX_PER_MINUTE);
  const pinchTargetScaleRef = useRef(BASE_PX_PER_MINUTE);
  const pinchFocalRef = useRef(0);
  const pinchRafRef = useRef<number | null>(null);

  const TIMELINE_END_BUFFER = 60; // Extra minutes to show past midnight and prevent cutoff.

  const rowLayout = useMemo(() => {
    if (isVertical) {
      return layoutVerticalEventsIntoColumns(tasksForSelectedDate);
    } else {
      return layoutEventsIntoRows(tasksForSelectedDate);
    }
  }, [tasksForSelectedDate, isVertical]);

  const timelineExtent = (DAY_MINUTES + TIMELINE_END_BUFFER) * pxPerMinute;
  const timelineMarks = useMemo(() => {
    const minuteStep = pxPerMinute >= 2 ? 30 : pxPerMinute >= 1.2 ? 60 : 120;
    const marks: number[] = [];
    for (let minute = 0; minute <= DAY_MINUTES; minute += minuteStep) {
      marks.push(minute);
    }
    return marks;
  }, [pxPerMinute]);

  const formatEventTime = (startMin: number, endMin: number) => {
    const formatMod = (min: number) => {
      const h = Math.floor(min / 60) % 24;
      const m = Math.floor(min % 60);
      const timeStr = formatTime(
        new Date(2000, 0, 1, h, m, 0),
        preferences.timeFormat,
      );
      return timeStr.replace(/\s*[AP]M$/i, '');
    };
    return `${formatMod(startMin)}-${formatMod(endMin)}`;
  };

  const slotSize = isVertical ? MAX_ROW_HEIGHT * 1.5 : MAX_ROW_HEIGHT;
  const EVENT_AXIS_GAP = 5;
  const MIN_EVENT_AXIS_SIZE = 26;

  const timelineBodyDimension = isVertical
    ? ((rowLayout as any).columnCount || 1) * slotSize
    : ((rowLayout as any).rowCount || 1) * slotSize;

  function onTimelineLayout(event: LayoutChangeEvent) {
    setTimelineHeight(event.nativeEvent.layout.height);
    setTimelineViewportWidth(event.nativeEvent.layout.width);
  }

  function clampScroll(value: number, scale: number): number {
    const viewportExtent = isVertical ? timelineHeight : timelineViewportWidth;
    const maxScroll = Math.max(0, (DAY_MINUTES + TIMELINE_END_BUFFER) * scale - viewportExtent);
    return Math.max(0, Math.min(maxScroll, value));
  }

  function pinchFocal(event: GestureResponderEvent): number {
    if (event.nativeEvent.touches.length < 2) {
      return 0;
    }
    const [a, b] = event.nativeEvent.touches;
    return isVertical
      ? (a.locationY + b.locationY) / 2
      : (a.locationX + b.locationX) / 2;
  }

  function startPinch(event: GestureResponderEvent) {
    if (event.nativeEvent.touches.length < 2) {
      return;
    }
    pinchStartDistanceRef.current = touchDistance(event);
    pinchAppliedScaleRef.current = pxPerMinute;
    pinchTargetScaleRef.current = pxPerMinute;
    pinchFocalRef.current = pinchFocal(event);
    if (pinchRafRef.current != null) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
  }

  function movePinch(event: GestureResponderEvent) {
    if (
      event.nativeEvent.touches.length < 2 ||
      pinchStartDistanceRef.current <= 0
    ) {
      return;
    }
    const currentDistance = touchDistance(event);
    if (currentDistance <= 0) {
      return;
    }
    pinchFocalRef.current = pinchFocal(event);
    const scaleFactor = currentDistance / pinchStartDistanceRef.current;
    let baseScale = pinchAppliedScaleRef.current;
    const nextScale = Math.max(
      MIN_PX_PER_MINUTE,
      Math.min(MAX_PX_PER_MINUTE, baseScale * scaleFactor),
    );
    if (Math.abs(nextScale - pinchTargetScaleRef.current) < 0.005) {
      return;
    }
    pinchTargetScaleRef.current = nextScale;

    if (pinchRafRef.current != null) {
      return;
    }
    pinchRafRef.current = requestAnimationFrame(() => {
      const previousScale = pinchAppliedScaleRef.current;
      const scale = pinchTargetScaleRef.current;
      const focal = pinchFocalRef.current;
      const contentOffset = scrollOffsetRef.current + focal;
      const minuteAtFocal =
        previousScale > 0 ? contentOffset / previousScale : 0;
      const nextScroll = clampScroll(minuteAtFocal * scale - focal, scale);

      pinchAppliedScaleRef.current = scale;
      setPxPerMinute(scale);
      scrollOffsetRef.current = nextScroll;

      if (isVertical) {
        scrollRef.current?.scrollTo({y: nextScroll, animated: false});
      } else {
        scrollRef.current?.scrollTo({x: nextScroll, animated: false});
      }

      pinchStartDistanceRef.current = currentDistance;
      pinchRafRef.current = null;
    });
  }

  function endPinch() {
    if (pinchRafRef.current != null) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
    const clamped = Math.max(
      MIN_PX_PER_MINUTE,
      Math.min(MAX_PX_PER_MINUTE, pinchTargetScaleRef.current),
    );
    pinchAppliedScaleRef.current = clamped;
    setPxPerMinute(clamped);
    pinchStartDistanceRef.current = 0;
  }

  function handleTimelinePress(event: RowPlacedTimelineEvent) {
    if (event.isHabit && event.habitId) {
      navigation.navigate('HabitDetail', {habitId: event.habitId});
      return;
    }
    if (event.taskId) {
      navigation.navigate('TaskDetail', {taskId: event.taskId});
    }
  }

  return (
    <View
      style={[
        styles.timelineSection,
        isLandscape && styles.timelineSectionLandscape,
      ]}>
      <Text style={styles.timelineTitle}>Timeline</Text>
      <View
        style={styles.timelineShell}
        onLayout={onTimelineLayout}
        onStartShouldSetResponder={event =>
          event.nativeEvent.touches.length >= 2
        }
        onMoveShouldSetResponder={event =>
          event.nativeEvent.touches.length >= 2
        }
        onResponderGrant={startPinch}
        onResponderMove={movePinch}
        onResponderRelease={endPinch}
        onResponderTerminate={endPinch}>
        <ScrollView
          ref={isVertical ? scrollRef : undefined}
          horizontal={false}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onScroll={isVertical ? event => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          } : undefined}
          scrollEventThrottle={16}>
          <ScrollView
            ref={!isVertical ? scrollRef : undefined}
            horizontal={true}
            contentContainerStyle={styles.timelineScrollContent}
            showsHorizontalScrollIndicator={false}
            onScroll={!isVertical ? event => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
            } : undefined}
            scrollEventThrottle={16}>
            {isVertical ? (
            <View
              style={[
                styles.timelineTrackVertical,
                {
                  height: timelineExtent,
                  width: Math.max(
                    timelineViewportWidth,
                    timelineBodyDimension + AXIS_HEIGHT + 32,
                  ),
                },
              ]}>
              {timelineMarks.map(minute => {
                const top = minute * pxPerMinute;
                const hour = Math.floor(minute / 60) % 24;
                const mins = minute % 60;
                return (
                  <View
                    key={`tick_${minute}`}
                    style={[styles.timeTickVertical, {top}]}>
                    <Text
                      style={[
                        styles.timeTickLabel,
                        {textAlign: 'right', marginRight: 4},
                      ]}>
                      {formatTime(
                        new Date(2000, 0, 1, hour, mins, 0),
                        preferences.timeFormat,
                      )}
                    </Text>
                  </View>
                );
              })}

              <View
                style={[
                  styles.timelineBodyVertical,
                  {left: AXIS_HEIGHT + 16, width: timelineBodyDimension},
                ]}>
                {rowLayout.placed.map(event => {
                  const startPx = event.startMinute * pxPerMinute;
                  const endPx = event.endMinute * pxPerMinute;
                  const rawSpan = Math.max(0, endPx - startPx);
                  const appliedGap = Math.min(
                    EVENT_AXIS_GAP,
                    Math.max(0, rawSpan - MIN_EVENT_AXIS_SIZE),
                  );
                  const top = startPx + appliedGap / 2;
                  const evtHeight = Math.max(
                    MIN_EVENT_AXIS_SIZE,
                    rawSpan - appliedGap,
                  );
                  const compact = evtHeight < 44;
                  const left = event.row * slotSize + 6;
                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => handleTimelinePress(event)}
                      style={[
                        styles.eventCard,
                        compact && styles.eventCardCompact,
                        {
                          top,
                          height: evtHeight,
                          left,
                          width: Math.max(48, slotSize - 12),
                        },
                        event.isHabit
                          ? styles.habitEventBase
                          : styles.taskEventBase,
                        event.completed &&
                          (event.isHabit
                            ? styles.habitEventCompleted
                            : styles.taskEventCompleted),
                      ]}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.eventTitle,
                          compact && styles.eventTitleCompact,
                          !event.isHabit &&
                            !event.completed &&
                            styles.taskEventTitleOnAccent,
                          event.isHabit &&
                            !event.completed &&
                            styles.habitEventTitleOnAccent,
                        ]}>
                        {event.title}
                      </Text>
                      {!compact && (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.eventMeta,
                            !event.isHabit &&
                              !event.completed &&
                              styles.taskEventMetaOnAccent,
                            event.isHabit &&
                              !event.completed &&
                              styles.habitEventMetaOnAccent,
                          ]}>
                          {formatEventTime(event.startMinute, event.endMinute)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.timelineTrack,
                {
                  width: timelineExtent,
                  height: Math.max(
                    timelineHeight,
                    timelineBodyDimension + AXIS_HEIGHT + 32,
                  ),
                },
              ]}>
              {timelineMarks.map(minute => {
                const left = minute * pxPerMinute;
                const hour = Math.floor(minute / 60) % 24;
                const mins = minute % 60;
                return (
                  <View
                    key={`tick_${minute}`}
                    style={[styles.timeTick, {left}]}>
                    <Text style={styles.timeTickLabel}>
                      {formatTime(
                        new Date(2000, 0, 1, hour, mins, 0),
                        preferences.timeFormat,
                      )}
                    </Text>
                  </View>
                );
              })}

              <View
                style={[
                  styles.timelineBody,
                  {top: AXIS_HEIGHT, height: timelineBodyDimension},
                ]}>
                {rowLayout.placed.map(event => {
                  const startPx = event.startMinute * pxPerMinute;
                  const endPx = event.endMinute * pxPerMinute;
                  const rawSpan = Math.max(0, endPx - startPx);
                  const appliedGap = Math.min(
                    EVENT_AXIS_GAP,
                    Math.max(0, rawSpan - MIN_EVENT_AXIS_SIZE),
                  );
                  const left = startPx + appliedGap / 2;
                  const evtWidth = Math.max(
                    MIN_EVENT_AXIS_SIZE,
                    rawSpan - appliedGap,
                  );
                  const compact = evtWidth < 90;
                  const top = event.row * slotSize + 6;
                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => handleTimelinePress(event)}
                      style={[
                        styles.eventCard,
                        compact && styles.eventCardCompact,
                        {
                          left,
                          width: evtWidth,
                          top,
                          height: Math.max(28, slotSize - 12),
                        },
                        event.isHabit
                          ? styles.habitEventBase
                          : styles.taskEventBase,
                        event.completed &&
                          (event.isHabit
                            ? styles.habitEventCompleted
                            : styles.taskEventCompleted),
                      ]}>
                      <View style={styles.eventContent}>
                        <Text
                        numberOfLines={1}
                        style={[
                          styles.eventTitle,
                          compact && styles.eventTitleCompact,
                          !event.isHabit &&
                            !event.completed &&
                            styles.taskEventTitleOnAccent,
                          event.isHabit &&
                            !event.completed &&
                            styles.habitEventTitleOnAccent,
                        ]}>
                        {event.title}
                      </Text>
                      {!compact && (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.eventMeta,
                            !event.isHabit &&
                              !event.completed &&
                              styles.taskEventMetaOnAccent,
                            event.isHabit &&
                              !event.completed &&
                              styles.habitEventMetaOnAccent,
                          ]}>
                          {formatEventTime(event.startMinute, event.endMinute)}
                        </Text>
                      )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            )}
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    timelineSection: {
      flex: 1,
      minHeight: 190,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 4,
      marginBottom: 80,
    },
    timelineSectionLandscape: {
      borderTopWidth: 0,
      flex: 1,
    },
    timelineTitle: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: fonts.heading,
      color: colors.text,
      marginTop: 4,
      marginBottom: 12,
    },
    timelineShell: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    timelineScrollContent: {
      minHeight: '100%',
      paddingRight: 32,
      paddingBottom: 32,
    },
    timelineTrack: {
      minHeight: AXIS_HEIGHT + MIN_ROW_HEIGHT,
      position: 'relative',
      backgroundColor: 'transparent',
    },
    timeTick: {
      position: 'absolute',
      top: 0,
      height: AXIS_HEIGHT,
      paddingLeft: 4,
      justifyContent: 'center',
    },
    timelineTrackVertical: {
      minWidth: AXIS_HEIGHT + MIN_ROW_HEIGHT * 1.5,
      position: 'relative',
      backgroundColor: 'transparent',
    },
    timeTickVertical: {
      position: 'absolute',
      left: 0,
      width: AXIS_HEIGHT + 16,
      justifyContent: 'flex-start',
    },
    timeTickLabel: {
      color: colors.mutedText,
      fontSize: 9,
      fontWeight: '600',
    },
    timelineBody: {
      position: 'absolute',
      left: 0,
      right: 0,
    },
    timelineBodyVertical: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    eventCard: {
      position: 'absolute',
      borderRadius: 8,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 8,
      justifyContent: 'center',
    },
    eventCardCompact: {
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    eventContent: {
      justifyContent: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    },
    taskEventBase: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    habitEventBase: {
      backgroundColor: colors.habitBadge,
      borderColor: colors.habitBadge,
    },
    taskEventCompleted: {
      backgroundColor: colors.accentLight,
    },
    habitEventCompleted: {
      backgroundColor: colors.habitBadgeLight,
      borderColor: colors.habitBadge,
    },
    eventTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      fontFamily: fonts.bodyBold,
      lineHeight: 13,
    },
    eventTitleCompact: {
      fontSize: 11,
      lineHeight: 12,
    },
    eventMeta: {
      color: colors.mutedText,
      fontSize: 8,
      fontWeight: '600',
      marginTop: 1,
    },
    taskEventTitleOnAccent: {
      color: 'white',
      fontWeight: '800',
    },
    taskEventMetaOnAccent: {
      color: 'white',
      opacity: 0.8,
    },
    habitEventTitleOnAccent: {
      color: 'white',
      fontWeight: '800',
    },
    habitEventMetaOnAccent: {
      color: 'white',
      opacity: 0.8,
    },
  });
