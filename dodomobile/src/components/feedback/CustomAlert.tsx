import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {spacing, radii, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type CustomAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
};

export function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: CustomAlertProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [renderVisible, setRenderVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 250,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.88,
          useNativeDriver: true,
          damping: 18,
          stiffness: 250,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => setRenderVisible(false));
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!renderVisible && !visible) {
    return null;
  }

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{text: 'OK', style: 'default'}];
  const isSingleAction = resolvedButtons.length === 1;

  function handlePress(button: AlertButton) {
    onDismiss();
    button.onPress?.();
  }

  return (
    <Modal
      transparent
      animationType="none"
      visible={renderVisible}
      onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, {opacity: opacityAnim}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          style={[
            styles.popup,
            {transform: [{scale: scaleAnim}], opacity: opacityAnim},
          ]}>

          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View
            style={[
              styles.buttonRow,
              isSingleAction && styles.buttonRowSingle,
            ]}>
            {resolvedButtons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isDefault = !isDestructive && !isCancel;
              return (
                <Pressable
                  key={`${btn.text}_${index}`}
                  style={({pressed}) => [
                    styles.button,
                    isSingleAction && styles.buttonSingle,
                    isDefault && styles.defaultButton,
                    isCancel && styles.cancelButton,
                    isDestructive && styles.destructiveButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handlePress(btn)}>
                  <Text
                    style={[
                      styles.buttonText,
                      isDefault && styles.defaultText,
                      isCancel && styles.cancelText,
                      isDestructive && styles.destructiveText,
                    ]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    popup: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
    },
    body: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.heading,
      letterSpacing: -0.6,
      marginBottom: 8,
    },
    message: {
      color: colors.mutedText,
      fontSize: fontSize.md,
      lineHeight: 22,
      fontFamily: fonts.bodyMedium,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.xs,
    },
    buttonRowSingle: {
      justifyContent: 'center',
    },
    button: {
      flex: 1,
      minHeight: 50,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonSingle: {
      flex: 0,
      width: '100%',
    },
    defaultButton: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 4,
    },
    cancelButton: {
      backgroundColor: colors.surfaceLight,
    },
    destructiveButton: {
      backgroundColor: colors.dangerLight,
    },
    buttonPressed: {
      opacity: 0.92,
      transform: [{scale: 0.985}],
    },
    buttonText: {
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
      letterSpacing: 0.2,
    },
    defaultText: {
      color: '#fff',
    },
    cancelText: {
      color: colors.textSecondary,
    },
    destructiveText: {
      color: colors.danger,
    },
  });
