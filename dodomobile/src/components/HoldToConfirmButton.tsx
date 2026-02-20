import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AppIcon, type AppIconName } from "./AppIcon";
import { fontSize, radii, spacing } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";

type HoldToConfirmButtonProps = {
  label?: string;
  iconName?: AppIconName;
  onHoldComplete: () => void;
  disabled?: boolean;
  holdDurationMs?: number;
  fillColor?: string;
  textColor?: string;
  square?: boolean;
  size?: number;
  progressStyle?: "fill" | "border";
  showHint?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatHoldHint(holdDurationMs: number): string {
  const seconds = holdDurationMs / 1000;
  const value = Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1);
  return `Hold ${value}s`;
}

export function HoldToConfirmButton({
  label,
  iconName,
  onHoldComplete,
  disabled = false,
  holdDurationMs = 3000,
  fillColor,
  textColor,
  square = false,
  size = 56,
  progressStyle = "fill",
  showHint,
  style,
}: HoldToConfirmButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const borderStroke = 3;
  const borderRadius = square ? Math.max(radii.xl, Math.round(size * 0.28)) : radii.lg;
  const resolvedFillColor = fillColor ?? colors.accent;
  const shouldShowHint = showHint ?? (!iconName && !!label);
  const contentColor = disabled ? colors.mutedText : (textColor ?? colors.text);
  const mutedFillColor = resolvedFillColor;
  const edgeTop = Math.max(0, Math.min(1, progress * 4));
  const edgeRight = Math.max(0, Math.min(1, progress * 4 - 1));
  const edgeBottom = Math.max(0, Math.min(1, progress * 4 - 2));
  const edgeLeft = Math.max(0, Math.min(1, progress * 4 - 3));
  const cornerSize = borderStroke * 3;
  const cornerTransition = 0.04;
  const cornerTopLeft = progress > 0 ? 1 : 0;
  const cornerTopRight = Math.max(0, Math.min(1, (progress - 0.25) / cornerTransition));
  const cornerBottomRight = Math.max(0, Math.min(1, (progress - 0.5) / cornerTransition));
  const cornerBottomLeft = Math.max(0, Math.min(1, (progress - 0.75) / cornerTransition));

  function clearHold(resetProgress = true) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    if (resetProgress) setProgress(0);
  }

  function startHold() {
    if (disabled) return;
    clearHold(false);
    doneRef.current = false;
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startRef.current == null) return;
      const elapsed = Date.now() - startRef.current;
      const nextProgress = Math.max(0, Math.min(1, elapsed / holdDurationMs));
      setProgress(nextProgress);
      if (nextProgress >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearHold();
        onHoldComplete();
      }
    }, 40);
  }

  useEffect(() => {
    return () => clearHold();
  }, []);

  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        { borderRadius },
        square && { width: size, height: size, minHeight: size, paddingVertical: 0, paddingHorizontal: 0 },
        style,
        disabled && styles.disabled,
      ]}
      onPressIn={startHold}
      onPressOut={() => clearHold()}
    >
      {progressStyle === "fill" ? (
        <View style={styles.progressTrackVertical}>
          <View style={[styles.progressFillVertical, { height: `${progress * 100}%`, backgroundColor: mutedFillColor }]} />
        </View>
      ) : (
        <View pointerEvents="none" style={styles.borderProgressWrap}>
          <View style={[styles.edgeTop, { height: borderStroke, backgroundColor: resolvedFillColor, width: `${edgeTop * 100}%` }]} />
          <View style={[styles.edgeRight, { width: borderStroke, backgroundColor: resolvedFillColor, height: `${edgeRight * 100}%` }]} />
          <View style={[styles.edgeBottom, { height: borderStroke, backgroundColor: resolvedFillColor, width: `${edgeBottom * 100}%` }]} />
          <View style={[styles.edgeLeft, { width: borderStroke, backgroundColor: resolvedFillColor, height: `${edgeLeft * 100}%` }]} />
          <View style={[styles.cornerDotTopLeft, { width: cornerSize, height: cornerSize, backgroundColor: resolvedFillColor, opacity: cornerTopLeft }]} />
          <View style={[styles.cornerDotTopRight, { width: cornerSize, height: cornerSize, backgroundColor: resolvedFillColor, opacity: cornerTopRight }]} />
          <View style={[styles.cornerDotBottomRight, { width: cornerSize, height: cornerSize, backgroundColor: resolvedFillColor, opacity: cornerBottomRight }]} />
          <View style={[styles.cornerDotBottomLeft, { width: cornerSize, height: cornerSize, backgroundColor: resolvedFillColor, opacity: cornerBottomLeft }]} />
        </View>
      )}

      {iconName ? <AppIcon name={iconName} size={22} color={contentColor} /> : null}
      {label ? <Text style={[styles.label, { color: contentColor }]}>{label}</Text> : null}
      {shouldShowHint ? <Text style={styles.hint}>{formatHoldHint(holdDurationMs)}</Text> : null}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentLight,
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    width: "0%",
    opacity: 0.22,
  },
  progressTrackVertical: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: colors.accentLight,
  },
  progressFillVertical: {
    width: "100%",
    opacity: 0.2,
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: "800",
  },
  borderProgressWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeTop: {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: 999,
  },
  edgeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    borderRadius: 999,
  },
  edgeBottom: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },
  edgeLeft: {
    position: "absolute",
    left: 0,
    bottom: 0,
    borderRadius: 999,
  },
  cornerDotTopLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: 999,
  },
  cornerDotTopRight: {
    position: "absolute",
    right: 0,
    top: 0,
    borderRadius: 999,
  },
  cornerDotBottomRight: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },
  cornerDotBottomLeft: {
    position: "absolute",
    left: 0,
    bottom: 0,
    borderRadius: 999,
  },
  hint: {
    marginTop: 3,
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
