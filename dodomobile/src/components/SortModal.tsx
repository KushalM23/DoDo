import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {spacing, radii, fontSize} from '../theme/colors';
import {type ThemeColors, useThemeColors} from '../theme/ThemeProvider';
import type {SortMode} from '../utils/taskSort';
import {AppIcon, type AppIconName} from './AppIcon';

type Props = {
  visible: boolean;
  current: SortMode;
  onSelect: (mode: SortMode) => void;
  onClose: () => void;
};

const OPTIONS: {mode: SortMode; label: string; icon: AppIconName}[] = [
  {mode: 'smart', label: 'Smart (Default)', icon: 'zap'},
  {mode: 'priority_desc', label: 'Priority: High to Low', icon: 'arrow-up'},
  {mode: 'priority_asc', label: 'Priority: Low to High', icon: 'arrow-down'},
  {mode: 'time_asc', label: 'Time: Earliest First', icon: 'sunrise'},
  {mode: 'time_desc', label: 'Time: Latest First', icon: 'sunset'},
  {mode: 'deadline_asc', label: 'Deadline: Earliest First', icon: 'calendar'},
  {mode: 'deadline_desc', label: 'Deadline: Latest First', icon: 'calendar'},
];

export function SortModal({visible, current, onSelect, onClose}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Sort Tasks</Text>
          {OPTIONS.map(({mode, label, icon}) => (
            <Pressable
              key={mode}
              style={[styles.option, current === mode && styles.optionActive]}
              onPress={() => {
                onSelect(mode);
                onClose();
              }}>
              <View
                style={[
                  styles.optionIconWrap,
                  current === mode && styles.optionIconWrapActive,
                ]}>
                <AppIcon
                  name={icon}
                  size={15}
                  color={current === mode ? colors.accent : colors.mutedText}
                />
              </View>
              <Text
                style={[
                  styles.optionText,
                  current === mode && styles.optionTextActive,
                ]}>
                {label}
              </Text>
              {current === mode && (
                <View style={styles.checkDot}>
                  <AppIcon name="check" size={12} color="#fff" />
                </View>
              )}
            </Pressable>
          ))}
          <View style={styles.bottomSpacer} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderColor: colors.borderStrong,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 14,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.lg,
      marginBottom: 4,
    },
    optionActive: {
      backgroundColor: colors.accentLight,
    },
    optionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconWrapActive: {
      backgroundColor: colors.accentLight,
    },
    optionText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
      flex: 1,
    },
    optionTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    checkDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomSpacer: {
      height: spacing.lg,
    },
  });
