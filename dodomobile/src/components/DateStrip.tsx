import React, { useCallback, useMemo, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, radii, fontSize } from "../theme/colors";
import { type ThemeColors, useThemeColors, useThemeMode } from "../theme/ThemeProvider";

type Props = {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CENTER_INDEX = 10;

function generateDays(): { key: string; dateStr: string; dayName: string; dayNum: number }[] {
  const today = new Date();
  const days: { key: string; dateStr: string; dayName: string; dayNum: number }[] = [];

  for (let i = -CENTER_INDEX; i <= CENTER_INDEX; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
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
const ITEM_WIDTH = 52;

export function DateStrip({ selectedDate, onSelectDate }: Props) {
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const listRef = useRef<FlatList>(null);
  const hasInitialCenteredRef = useRef(false);
  const initialIndex = useMemo(() => {
    const idx = DAYS.findIndex((d) => d.dateStr === selectedDate);
    return idx >= 0 ? idx : CENTER_INDEX;
  }, [selectedDate]);

  const centerIndex = useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToIndex({ index, animated, viewPosition: 0.5 });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof DAYS)[0] }) => {
      const active = item.dateStr === selectedDate;
      const isToday = item.dateStr === DAYS[CENTER_INDEX].dateStr;
      return (
        <Pressable
          style={[styles.dayItem, isToday && styles.dayItemToday, active && styles.dayItemActive]}
          onPress={() => onSelectDate(item.dateStr)}
        >
          <Text style={[styles.dayName, active && styles.dayNameActive]}>{item.dayName}</Text>
          <Text style={[styles.dayNum, active && styles.dayNumActive]}>{item.dayNum}</Text>
          {isToday && <View style={[styles.todayDot, active && styles.todayDotActive]} />}
        </Pressable>
      );
    },
    [selectedDate, onSelectDate, styles],
  );

  return (
    <FlatList
      ref={listRef}
      data={DAYS}
      extraData={`${selectedDate}:${themeMode}`}
      horizontal
      initialScrollIndex={initialIndex}
      onLayout={() => {
        if (hasInitialCenteredRef.current) return;
        hasInitialCenteredRef.current = true;
        requestAnimationFrame(() => centerIndex(initialIndex, false));
      }}
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.container}
      onScrollToIndexFailed={() => {
        requestAnimationFrame(() => centerIndex(initialIndex, false));
      }}
      getItemLayout={(_, index) => ({
        length: ITEM_WIDTH + 6,
        offset: (ITEM_WIDTH + 6) * index,
        index,
      })}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  dayItem: {
    width: ITEM_WIDTH,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayItemActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayItemToday: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  dayName: {
    fontSize: fontSize.xs,
    color: colors.mutedText,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayNameActive: {
    color: colors.surface,
  },
  dayNum: {
    fontSize: fontSize.md + 1,
    fontWeight: "700",
    color: colors.text,
  },
  dayNumActive: {
    color: colors.surface,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
  todayDotActive: {
    backgroundColor: colors.surface,
  },
});
