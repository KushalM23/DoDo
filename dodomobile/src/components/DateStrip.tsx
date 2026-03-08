import React, {useCallback, useMemo, useRef} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {spacing, radii, fontSize} from '../theme/colors';
import {
  type ThemeColors,
  useThemeColors,
  useThemeMode,
} from '../theme/ThemeProvider';

type Props = {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  incompleteDateKeys?: Set<string>;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CENTER_INDEX = 10;

function generateDays(): {
  key: string;
  dateStr: string;
  dayName: string;
  dayNum: number;
}[] {
  const today = new Date();
  const days: {
    key: string;
    dateStr: string;
    dayName: string;
    dayNum: number;
  }[] = [];

  for (let i = -CENTER_INDEX; i <= CENTER_INDEX; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push({
      key: `${yyyy}-${mm}-${dd}`,
      dateStr: `${yyyy}-${mm}-${dd}`,
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
    });
  }
  return days;
}

const DAYS = generateDays();
const ITEM_WIDTH = 50;
const ITEM_GAP = 6;

export function DateStrip({
  selectedDate,
  onSelectDate,
  incompleteDateKeys,
}: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const listRef = useRef<FlatList>(null);
  const hasInitialCenteredRef = useRef(false);
  const initialIndex = useMemo(() => {
    const idx = DAYS.findIndex(d => d.dateStr === selectedDate);
    return idx >= 0 ? idx : CENTER_INDEX;
  }, [selectedDate]);

  const centerIndex = useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToIndex({index, animated, viewPosition: 0.5});
  }, []);

  const renderItem = useCallback(
    ({item}: {item: (typeof DAYS)[0]}) => {
      const active = item.dateStr === selectedDate;
      const isToday = item.dateStr === DAYS[CENTER_INDEX].dateStr;
      const hasIncomplete = incompleteDateKeys?.has(item.dateStr) ?? false;
      return (
        <Pressable
          style={[
            styles.dayItem,
            isToday && !active && styles.dayItemToday,
            active && styles.dayItemActive,
          ]}
          onPress={() => onSelectDate(item.dateStr)}>
          <Text
            style={[
              styles.dayName,
              active && styles.dayNameActive,
              isToday && !active && styles.dayNameToday,
            ]}>
            {item.dayName}
          </Text>
          <Text style={[styles.dayNum, active && styles.dayNumActive]}>
            {item.dayNum}
          </Text>
          <View style={styles.dotRow}>
            {hasIncomplete ? (
              <View
                style={[
                  styles.incompleteDot,
                  active && styles.incompleteDotActive,
                ]}
              />
            ) : (
              <View style={styles.dotPlaceholder} />
            )}
          </View>
        </Pressable>
      );
    },
    [selectedDate, onSelectDate, styles, incompleteDateKeys],
  );

  return (
    <FlatList
      ref={listRef}
      data={DAYS}
      extraData={`${selectedDate}:${themeMode}:${
        incompleteDateKeys?.size ?? 0
      }`}
      horizontal
      initialScrollIndex={initialIndex}
      onLayout={() => {
        if (hasInitialCenteredRef.current) {
          return;
        }
        hasInitialCenteredRef.current = true;
        requestAnimationFrame(() => centerIndex(initialIndex, false));
      }}
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      contentContainerStyle={styles.container}
      onScrollToIndexFailed={() => {
        requestAnimationFrame(() => centerIndex(initialIndex, false));
      }}
      getItemLayout={(_, index) => ({
        length: ITEM_WIDTH + ITEM_GAP,
        offset: (ITEM_WIDTH + ITEM_GAP) * index,
        index,
      })}
    />
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: ITEM_GAP,
      paddingHorizontal: 4,
    },
    dayItem: {
      width: ITEM_WIDTH,
      alignItems: 'center',
      paddingVertical: spacing.xs - 2,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
    },
    dayItemActive: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    dayItemToday: {
      backgroundColor: colors.accentLight,
    },
    dayName: {
      fontSize: 10,
      color: colors.mutedText,
      fontWeight: '700',
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dayNameActive: {
      color: '#fff',
    },
    dayNameToday: {
      color: colors.accent,
    },
    dayNum: {
      fontSize: fontSize.md,
      fontWeight: '800',
      color: colors.text,
    },
    dayNumActive: {
      color: '#fff',
    },
    dotRow: {
      marginTop: 4,
      height: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotPlaceholder: {
      width: 5,
      height: 5,
    },
    incompleteDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.danger,
    },
    incompleteDotActive: {
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
  });
