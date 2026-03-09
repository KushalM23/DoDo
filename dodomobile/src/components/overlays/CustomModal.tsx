import React, {useRef, useMemo, useEffect} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {spacing, radii, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {AppIcon} from '../AppIcon';

type CustomModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function CustomModal({
  visible,
  title,
  onClose,
  children,
}: CustomModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Track if the modal itself thinks it should be visible based on animation completion.
  // This helps us keep `Modal` open while animating out.
  const [renderVisible, setRenderVisible] = React.useState(visible);

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

  return (
    <Modal
      transparent
      animationType="none"
      visible={renderVisible}
      onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, {opacity: opacityAnim}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <Animated.View
            style={[
              styles.popup,
              {transform: [{scale: scaleAnim}], opacity: opacityAnim},
            ]}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <AppIcon name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.content}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    keyboardView: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    popup: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 20},
      shadowOpacity: 1,
      shadowRadius: 40,
      elevation: 20,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.heading,
      letterSpacing: -0.5,
    },
    closeBtn: {
      padding: spacing.xs,
      borderRadius: radii.md,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
  });
