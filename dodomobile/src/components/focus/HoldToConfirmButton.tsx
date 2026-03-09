import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {AppIcon, type AppIconName} from '../AppIcon';
import {radii} from '../../theme/colors';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

type HoldToConfirmButtonProps = {
  iconName: AppIconName;
  onHoldComplete: () => void;
  disabled?: boolean;
  holdDurationMs?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  progressColor?: string;
  iconColor?: string;
  disabledIconColor?: string;
};

export function HoldToConfirmButton({
  iconName,
  onHoldComplete,
  disabled = false,
  holdDurationMs = 3000,
  size = 56,
  style,
  backgroundColor,
  progressColor,
  iconColor,
  disabledIconColor,
}: HoldToConfirmButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const splashScale = useRef(new Animated.Value(1)).current;
  const splashOpacity = useRef(new Animated.Value(0)).current;

  function clearHold(resetProgress = true) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    if (resetProgress) {
      setProgress(0);
    }
  }

  function playSplash() {
    splashScale.setValue(1);
    splashOpacity.setValue(0.35);

    Animated.parallel([
      Animated.timing(splashScale, {
        toValue: 1.55,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setProgress(0);
      onHoldComplete();
    });
  }

  function startHold() {
    if (disabled) {
      return;
    }

    clearHold(false);
    doneRef.current = false;
    startRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (startRef.current == null) {
        return;
      }

      const elapsed = Date.now() - startRef.current;
      const nextProgress = Math.max(0, Math.min(1, elapsed / holdDurationMs));
      setProgress(nextProgress);

      if (nextProgress >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearHold(false);
        setProgress(1);
        playSplash();
      }
    }, 40);
  }

  useEffect(
    () => () => {
      clearHold();
      splashScale.stopAnimation();
      splashOpacity.stopAnimation();
    },
    [splashOpacity, splashScale],
  );

  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        backgroundColor != null && {backgroundColor},
        {
          borderRadius: Math.round(size / 2),
          width: size,
          height: size,
          minHeight: size,
          paddingVertical: 0,
          paddingHorizontal: 0,
        },
        style,
        disabled && styles.disabled,
      ]}
      onPressIn={startHold}
      onPressOut={() => clearHold()}>
      <View style={styles.radialTrack} pointerEvents="none">
        <View
          style={[
            styles.radialFill,
            {
              backgroundColor: progressColor ?? colors.accent,
              transform: [{scale: Math.max(0, progress)}],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.splashFill,
            {
              backgroundColor: progressColor ?? colors.accent,
              opacity: splashOpacity,
              transform: [{scale: splashScale}],
            },
          ]}
        />
      </View>

      <AppIcon
        name={iconName}
        size={24}
        color={
          disabled
            ? disabledIconColor ?? colors.mutedText
            : iconColor ?? colors.text
        }
      />
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      minHeight: 56,
    },
    radialTrack: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radialFill: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
      opacity: 1,
    },
    splashFill: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 999,
    },
    disabled: {
      opacity: 0.5,
    },
  });
