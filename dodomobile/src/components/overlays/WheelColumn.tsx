import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  DimensionValue,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {fontSize, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

type WheelColumnProps = {
  items: string[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  itemHeight?: number;
  visibleRowCount?: number;
  width?: DimensionValue;
  testID?: string;
  isActive?: boolean;
};

type WheelRowProps = {
  item: string;
  index: number;
  itemHeight: number;
  sideItemCount: number;
  scrollOffsetY: Animated.Value;
  selectedIndex: number;
  colors: ThemeColors;
  onPress: (index: number) => void;
  disabled?: boolean;
};

const WheelRow = React.memo(function WheelRow({
  item,
  index,
  itemHeight,
  sideItemCount,
  scrollOffsetY,
  selectedIndex,
  colors,
  onPress,
  disabled = false,
}: WheelRowProps) {
  const steps = useMemo(
    () => Array.from({length: sideItemCount * 2 + 1}, (_, stepIndex) => stepIndex - sideItemCount),
    [sideItemCount],
  );
  const inputRange = useMemo(
    () => steps.map(step => (index + step) * itemHeight),
    [index, itemHeight, steps],
  );
  const opacityOutputRange = useMemo(
    () =>
      steps.map(step => {
        const normalizedDistance = Math.abs(step) / Math.max(1, sideItemCount);
        return Math.max(0.12, 1 - normalizedDistance * 0.88);
      }),
    [sideItemCount, steps],
  );
  const rotateOutputRange = useMemo(
    () =>
      steps.map(step => {
        const normalizedDistance = step / Math.max(1, sideItemCount);
        return `${-normalizedDistance * 0.72}deg`;
      }),
    [sideItemCount, steps],
  );
  const scaleOutputRange = useMemo(
    () =>
      steps.map(step => {
        const normalizedDistance = Math.abs(step) / Math.max(1, sideItemCount);
        return 1 - normalizedDistance * 0.25;
      }),
    [sideItemCount, steps],
  );
  const translateYOutputRange = useMemo(
    () =>
      steps.map(step => {
        const normalizedDistance = step / Math.max(1, sideItemCount);
        return -normalizedDistance * itemHeight * 0.05;
      }),
    [itemHeight, sideItemCount, steps],
  );
  const animatedStyle = useMemo(
    () => ({
      opacity: scrollOffsetY.interpolate({
        inputRange,
        outputRange: opacityOutputRange,
        extrapolate: 'clamp',
      }),
      transform: [
        {perspective: 1000},
        {
          translateY: scrollOffsetY.interpolate({
            inputRange,
            outputRange: translateYOutputRange,
            extrapolate: 'clamp',
          }),
        },
        {
          rotateX: scrollOffsetY.interpolate({
            inputRange,
            outputRange: rotateOutputRange,
            extrapolate: 'clamp',
          }),
        },
        {
          scale: scrollOffsetY.interpolate({
            inputRange,
            outputRange: scaleOutputRange,
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [
      inputRange,
      opacityOutputRange,
      rotateOutputRange,
      scaleOutputRange,
      scrollOffsetY,
      translateYOutputRange,
    ],
  );

  const distanceFromSelected = Math.abs(index - selectedIndex);
  const labelColor =
    distanceFromSelected === 0
      ? colors.accent
      : distanceFromSelected === 1
        ? colors.textSecondary
        : colors.mutedText;

  return (
    <Pressable disabled={disabled} onPress={() => onPress(index)}>
      <Animated.View style={[wheelRowStyles.row, {height: itemHeight}, animatedStyle]}>
        <Text
          numberOfLines={1}
          style={[
            wheelRowStyles.label,
            {color: labelColor},
            distanceFromSelected === 0 ? wheelRowStyles.labelSelected : null,
          ]}>
          {item}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

const wheelRowStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
  labelSelected: {
    fontFamily: fonts.bodyBold,
  },
});

export function WheelColumn({
  items,
  selectedIndex,
  onSelectedIndexChange,
  itemHeight = 48,
  visibleRowCount = 7,
  width = '100%',
  testID,
  isActive = true,
}: WheelColumnProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const listRef = useRef<FlatList<string>>(null);
  const hasMountedRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
  const momentumScrollFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const selectedIndexRef = useRef(0);
  const pendingSyncIndexRef = useRef<number | null>(null);
  const previousItemsLengthRef = useRef(items.length);
  const scrollOffsetY = useRef(
    new Animated.Value(Math.max(0, Math.min(items.length - 1, selectedIndex)) * itemHeight),
  ).current;
  const sideItemCount = Math.floor(visibleRowCount / 2);
  const verticalPadding = (itemHeight * (visibleRowCount - 1)) / 2;
  const [layoutReady, setLayoutReady] = useState(false);

  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(items.length - 1, index)),
    [items.length],
  );

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const nextIndex = clampIndex(index);
      const nextOffset = nextIndex * itemHeight;
      currentIndexRef.current = nextIndex;

      if (!animated) {
        scrollOffsetY.setValue(nextOffset);
      }

      listRef.current?.scrollToOffset({
        offset: nextOffset,
        animated,
      });
    },
    [clampIndex, itemHeight, scrollOffsetY],
  );

  const clearMomentumFallback = useCallback(() => {
    if (momentumScrollFallbackRef.current != null) {
      clearTimeout(momentumScrollFallbackRef.current);
      momentumScrollFallbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    const nextIndex = clampIndex(selectedIndex);
    selectedIndexRef.current = nextIndex;

    if (!isActive) {
      wasActiveRef.current = false;
      hasMountedRef.current = false;
      pendingSyncIndexRef.current = nextIndex;
      previousItemsLengthRef.current = items.length;
      currentIndexRef.current = nextIndex;
      return;
    }

    const openedNow = !wasActiveRef.current;
    const itemsChanged = previousItemsLengthRef.current !== items.length;
    previousItemsLengthRef.current = items.length;
    wasActiveRef.current = true;

    if (!layoutReady) {
      pendingSyncIndexRef.current = nextIndex;
      currentIndexRef.current = nextIndex;
      return;
    }

    if (!openedNow && !itemsChanged && currentIndexRef.current === nextIndex) {
      return;
    }

    const shouldAnimate = hasMountedRef.current && !openedNow;
    currentIndexRef.current = nextIndex;
    pendingSyncIndexRef.current = null;

    scrollToIndex(nextIndex, shouldAnimate);
    hasMountedRef.current = true;
  }, [clampIndex, isActive, items.length, layoutReady, scrollToIndex, selectedIndex]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const nextIndex = clampIndex(selectedIndexRef.current);
    currentIndexRef.current = nextIndex;
  }, [clampIndex, items.length]);

  useEffect(() => () => clearMomentumFallback(), [clearMomentumFallback]);

  const commitIndexFromOffset = useCallback(
    (offsetY: number) => {
      const nextIndex = clampIndex(Math.round(offsetY / itemHeight));
      currentIndexRef.current = nextIndex;
      if (nextIndex !== selectedIndexRef.current) {
        onSelectedIndexChange(nextIndex);
      }
      scrollToIndex(nextIndex, false);
    },
    [clampIndex, onSelectedIndexChange, scrollToIndex],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitIndexFromOffset(event.nativeEvent.contentOffset.y);
    },
    [commitIndexFromOffset],
  );

  const handleMomentumScrollBegin = useCallback(() => {
    clearMomentumFallback();
    isMomentumScrollingRef.current = true;
  }, [clearMomentumFallback]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearMomentumFallback();
      isMomentumScrollingRef.current = false;
      handleScrollEnd(event);
    },
    [clearMomentumFallback, handleScrollEnd],
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearMomentumFallback();

      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
      const offsetY = event.nativeEvent.contentOffset.y;

      if (isMomentumScrollingRef.current || velocityY > 0.05) {
        momentumScrollFallbackRef.current = setTimeout(() => {
          if (!isMomentumScrollingRef.current) {
            commitIndexFromOffset(offsetY);
          }
        }, 80);
        return;
      }

      handleScrollEnd(event);
    },
    [clearMomentumFallback, commitIndexFromOffset, handleScrollEnd],
  );

  const handleScroll = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollOffsetY}}}], {
        useNativeDriver: true,
      }),
    [scrollOffsetY],
  );

  const handleLayout = useCallback(() => {
    if (!layoutReady) {
      setLayoutReady(true);
    }

    if (pendingSyncIndexRef.current == null) {
      return;
    }

    const nextIndex = pendingSyncIndexRef.current;
    pendingSyncIndexRef.current = null;

    scrollToIndex(nextIndex, false);
    hasMountedRef.current = true;
  }, [layoutReady, scrollToIndex]);

  const handleRowPress = useCallback(
    (index: number) => {
      if (!isActive || items.length === 0) {
        return;
      }

      const nextIndex = clampIndex(index);

      if (nextIndex === selectedIndexRef.current && nextIndex === currentIndexRef.current) {
        return;
      }

      clearMomentumFallback();
      isMomentumScrollingRef.current = false;
      currentIndexRef.current = nextIndex;
      scrollToIndex(nextIndex, true);

      if (nextIndex !== selectedIndexRef.current) {
        onSelectedIndexChange(nextIndex);
      }
    },
    [clampIndex, clearMomentumFallback, isActive, items.length, onSelectedIndexChange, scrollToIndex],
  );

  return (
    <View
      onLayout={handleLayout}
      style={{width, height: itemHeight * visibleRowCount, overflow: 'hidden'}}
      testID={testID}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionFrame,
          {
            top: verticalPadding,
            height: itemHeight,
          },
        ]}
      />
      <Animated.FlatList
        ref={listRef}
        data={items}
        initialScrollIndex={clampIndex(selectedIndex)}
        keyExtractor={(_, index) => `wheel-item-${index}`}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews={false}
        initialNumToRender={Math.min(items.length, visibleRowCount + 8)}
        maxToRenderPerBatch={visibleRowCount + 8}
        windowSize={visibleRowCount + 6}
        scrollEnabled={isActive && items.length > 1}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{paddingVertical: verticalPadding}}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        renderItem={({item, index}) => {
          return (
            <WheelRow
              item={item}
              index={index}
              itemHeight={itemHeight}
              sideItemCount={sideItemCount}
              scrollOffsetY={scrollOffsetY}
              selectedIndex={selectedIndex}
              colors={colors}
              onPress={handleRowPress}
              disabled={!isActive}
            />
          );
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    selectionFrame: {
      position: 'absolute',
      left: spacing.sm,
      right: spacing.sm,
      borderRadius: 99,
      backgroundColor: colors.accentLight,
      zIndex: 1,
    },
  });