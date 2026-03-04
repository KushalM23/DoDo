import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {type ThemeColors, useThemeColors} from '../theme/ThemeProvider';

type Props = {variant?: 'app' | 'screen'; title?: string};

export function LoadingScreen({variant = 'screen', title}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // All animations use useNativeDriver: false so they can be in the same loop
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.06,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 900,
            useNativeDriver: false,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scaleAnim, opacityAnim]);

  const shadowOpacity = opacityAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0.25, 0.55],
  });

  if (variant === 'app') {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.brandSlab,
            {
              transform: [{scale: scaleAnim}],
              opacity: opacityAnim,
              shadowOpacity,
            },
          ]}>
          <View style={styles.brandDot} />
        </Animated.View>
        <Text style={styles.brandName}>{title ?? 'dodo'}</Text>
      </View>
    );
  }

  // Screen loader: three pulsing dots
  const dot1 = opacityAnim;
  const dot2 = opacityAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0.4, 0.8],
  });
  const dot3 = opacityAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0.2, 0.5],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={styles.dotRow}>
        <Animated.View
          style={[styles.dot, styles.dotOrange, {opacity: dot1}]}
        />
        <Animated.View style={[styles.dot, styles.dotSm, {opacity: dot2}]} />
        <Animated.View style={[styles.dot, styles.dotSm, {opacity: dot3}]} />
      </Animated.View>
      {title ? <Text style={styles.inlineLabel}>{title}</Text> : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    brandSlab: {
      width: 80,
      height: 80,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOffset: {width: 0, height: 12},
      shadowRadius: 24,
      elevation: 12,
    },
    brandDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#fff',
    },
    brandName: {
      fontSize: 32,
      fontWeight: '900',
      color: c.text,
      letterSpacing: -1.5,
    },
    dotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      borderRadius: 99,
    },
    dotOrange: {
      width: 12,
      height: 12,
      backgroundColor: c.accent,
    },
    dotSm: {
      width: 8,
      height: 8,
      backgroundColor: c.border,
    },
    inlineLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: c.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  });
