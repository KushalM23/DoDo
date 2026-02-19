import React, { useCallback, useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, radii, fontSize } from "../theme/colors";

type Props = {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOTAL_DAYS = 21; // 3 weeks centered on today
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
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const idx = DAYS.findIndex((d) => d.dateStr === selectedDate);
    if (idx >= 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }, 100);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof DAYS)[0] }) => {
      const active = item.dateStr === selectedDate;
      const isToday = item.dateStr === DAYS[CENTER_INDEX].dateStr;
      return (
        <Pressable
          style={[styles.dayItem, active && styles.dayItemActive]}
          onPress={() => onSelectDate(item.dateStr)}
        >
          <Text style={[styles.dayName, active && styles.dayNameActive]}>{item.dayName}</Text>
          <Text style={[styles.dayNum, active && styles.dayNumActive]}>{item.dayNum}</Text>
          {isToday && <View style={[styles.todayDot, active && styles.todayDotActive]} />}
        </Pressable>
      );
    },
    [selectedDate, onSelectDate],
  );

  return (
    <FlatList
      ref={listRef}
      data={DAYS}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.container}
      getItemLayout={(_, index) => ({
        length: ITEM_WIDTH + 6,
        offset: (ITEM_WIDTH + 6) * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
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
  dayName: {
    fontSize: fontSize.xs,
    color: colors.mutedText,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayNameActive: {
    color: "#fff",
  },
  dayNum: {
    fontSize: fontSize.md + 1,
    fontWeight: "700",
    color: colors.text,
  },
  dayNumActive: {
    color: "#fff",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
  todayDotActive: {
    backgroundColor: "#fff",
  },
});
