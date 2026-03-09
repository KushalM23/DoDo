import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppIcon, type AppIconName} from '../AppIcon';
import {HoldToConfirmButton} from './HoldToConfirmButton';
import {FocusFlipClock} from './FocusFlipClock';
import {useAlert} from '../../state/AlertContext';
import {fontSize, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {darkColors, type ThemeColors} from '../../theme/ThemeProvider';
import {
  disableFocusModeSilence,
  enableFocusModeSilence,
  openFocusModeSilenceSettings,
} from '../../utils/focusModeSilencer';

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
  infoIconBackgroundColor?: string;
  elapsedSeconds?: number;
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
  infoIconBackgroundColor,
  elapsedSeconds,
}: FocusModeScreenProps) {
  const colors = darkColors;
  const styles = useMemo(() => createStyles(colors), []);
  const {showAlert} = useAlert();
  const didPromptForSilenceAccess = useRef(false);
  const focusSilenceEnabled = useRef(false);

  const hour24 = now.getHours();
  const hour = timeFormat === '24h' ? hour24 : ((hour24 + 11) % 12) + 1;

  const releaseFocusModeSilence = useCallback(async () => {
    if (!focusSilenceEnabled.current) {
      return;
    }

    focusSilenceEnabled.current = false;
    await disableFocusModeSilence();
  }, []);

  const handleExitFocus = useCallback(() => {
    void releaseFocusModeSilence();
    onExitFocus();
  }, [onExitFocus, releaseFocusModeSilence]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await enableFocusModeSilence();
      if (result === 'enabled') {
        focusSilenceEnabled.current = true;
      }
      if (
        cancelled ||
        result !== 'permission_required' ||
        didPromptForSilenceAccess.current
      ) {
        return;
      }

      didPromptForSilenceAccess.current = true;
      showAlert(
        'Allow Do Not Disturb',
        'Android needs Do Not Disturb access to silence the device automatically when focus mode starts.',
        [
          {text: 'Not now', style: 'cancel'},
          {
            text: 'Open settings',
            onPress: () => {
              void openFocusModeSilenceSettings();
            },
          },
        ],
      );
    })();

    return () => {
      cancelled = true;
      void releaseFocusModeSilence();
    };
  }, [releaseFocusModeSilence, showAlert]);

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
              <View>
                <AppIcon
                  name={infoIconName}
                  size={24}
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

          {typeof elapsedSeconds === 'number' ? (
            <FocusFlipClock totalSeconds={elapsedSeconds} />
          ) : null}
        </View>

        <View style={styles.floatingActions}>
          <HoldToConfirmButton
            iconName="lock-open"
            onHoldComplete={handleExitFocus}
            holdDurationMs={3000}
            size={84}
            backgroundColor={colors.surface}
            progressColor={colors.accent}
            iconColor={colors.text}
            disabledIconColor={colors.mutedText}
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
      minHeight: 220,
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
      marginTop: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xxl,
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
      marginBottom: 8,
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
