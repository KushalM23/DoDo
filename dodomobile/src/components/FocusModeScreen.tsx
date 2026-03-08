import React, {useMemo} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppIcon, type AppIconName} from './AppIcon';
import {HoldToConfirmButton} from './HoldToConfirmButton';
import {fontSize, radii, spacing} from '../theme/colors';
import {fonts} from '../theme/fonts';
import {type ThemeColors, useThemeColors} from '../theme/ThemeProvider';

type FocusModeScreenProps = {
  now: Date;
  timeFormat: '12h' | '24h';
  title: string;
  metaLines: string[];
  onExitFocus: () => void;
  actionLabel: string;
  actionIconName: AppIconName;
  onActionPress: () => void;
  actionDisabled?: boolean;
  actionDone?: boolean;
  actionTextColor?: string;
  actionIconColor?: string;
  infoIconName?: AppIconName;
  infoIconColor?: string;
  infoIconBorderColor?: string;
  infoIconBackgroundColor?: string;
};

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function FocusModeScreen({
  now,
  timeFormat,
  title,
  metaLines,
  onExitFocus,
  actionLabel,
  actionIconName,
  onActionPress,
  actionDisabled = false,
  actionDone = false,
  actionTextColor,
  actionIconColor,
  infoIconName,
  infoIconColor,
  infoIconBorderColor,
  infoIconBackgroundColor,
}: FocusModeScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hour24 = now.getHours();
  const hour = timeFormat === '24h' ? hour24 : ((hour24 + 11) % 12) + 1;

  return (
    <>
      <StatusBar hidden animated />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.clockWrap}>
            <Text style={styles.clockLine}>{twoDigits(hour)}</Text>
            <Text style={styles.clockLine}>{twoDigits(now.getMinutes())}</Text>
          </View>

          <View style={styles.infoBlock}>
            {infoIconName ? (
              <View
                style={[
                  styles.iconPill,
                  {
                    borderColor: infoIconBorderColor ?? colors.border,
                    backgroundColor: infoIconBackgroundColor ?? colors.surface,
                  },
                ]}>
                <AppIcon
                  name={infoIconName}
                  size={18}
                  color={infoIconColor ?? colors.text}
                />
              </View>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            {metaLines.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.meta}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.floatingActions}>
          <HoldToConfirmButton
            iconName="lock-open"
            onHoldComplete={onExitFocus}
            holdDurationMs={3000}
            size={84}
            style={styles.exitBtn}
          />

          <View style={styles.actionsRow}>
            <Pressable
              style={[
                styles.actionBtn,
                actionDone ? styles.actionBtnDone : styles.actionBtnPrimary,
                actionDisabled && styles.actionBtnDisabled,
              ]}
              onPress={onActionPress}
              disabled={actionDisabled}>
              <AppIcon
                name={actionIconName}
                size={16}
                color={actionIconColor ?? (actionDone ? colors.accent : '#fff')}
              />
              <Text
                style={[
                  styles.actionText,
                  {
                    color: actionTextColor ?? (actionDone ? colors.accent : '#fff'),
                  },
                ]}>
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: 260,
      gap: spacing.sm,
    },
    clockWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
      paddingVertical: spacing.md,
    },
    clockLine: {
      color: colors.text,
      fontSize: 120,
      fontFamily: fonts.heading,
      lineHeight: 150,
      letterSpacing: -2,
      includeFontPadding: false,
    },
    infoBlock: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    iconPill: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.headingSemiBold,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    meta: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      textAlign: 'center',
      fontFamily: fonts.body,
    },
    exitBtn: {
      marginBottom: 56,
      alignSelf: 'center',
    },
    floatingActions: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      bottom: 20,
      gap: spacing.lg,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      width: '100%',
    },
    actionBtn: {
      flex: 1,
      borderRadius: 999,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionBtnPrimary: {
      backgroundColor: colors.accent,
    },
    actionBtnDone: {
      backgroundColor: colors.surface,
    },
    actionBtnDisabled: {
      opacity: 0.5,
    },
    actionText: {
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
    },
  });