import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, radii, fontSize } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";
import type { SortMode } from "../utils/taskSort";
import { AppIcon, type AppIconName } from "./AppIcon";

type Props = {
  visible: boolean;
  current: SortMode;
  onSelect: (mode: SortMode) => void;
  onClose: () => void;
};

const OPTIONS: { mode: SortMode; label: string; icon: AppIconName }[] = [
  { mode: "smart", label: "Smart (Default)", icon: "zap" },
  { mode: "priority_desc", label: "Priority: High to Low", icon: "arrow-up" },
  { mode: "priority_asc", label: "Priority: Low to High", icon: "arrow-down" },
  { mode: "time_asc", label: "Time: Earliest First", icon: "sunrise" },
  { mode: "time_desc", label: "Time: Latest First", icon: "sunset" },
  { mode: "deadline_asc", label: "Deadline: Earliest First", icon: "calendar" },
  { mode: "deadline_desc", label: "Deadline: Latest First", icon: "calendar" },
];

export function SortModal({ visible, current, onSelect, onClose }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Sort Tasks</Text>
          {OPTIONS.map(({ mode, label, icon }) => (
            <Pressable
              key={mode}
              style={[styles.option, current === mode && styles.optionActive]}
              onPress={() => {
                onSelect(mode);
                onClose();
              }}
            >
              <AppIcon
                name={icon}
                size={16}
                color={current === mode ? colors.accent : colors.mutedText}
              />
              <Text style={[styles.optionText, current === mode && styles.optionTextActive]}>
                {label}
              </Text>
              {current === mode && <AppIcon name="check" size={16} color={colors.accent} />}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 36,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  optionActive: {
    backgroundColor: colors.accentLight,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: "500",
    flex: 1,
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
});
