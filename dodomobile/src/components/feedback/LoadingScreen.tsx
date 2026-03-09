import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

type Props = {
  variant?: 'app' | 'screen';
  title?: string;
  exiting?: boolean;
  onExitComplete?: () => void;
};

export function LoadingScreen({
  variant = 'screen',
  title,
  exiting = false,
  onExitComplete,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {width, height} = useWindowDimensions();

  const circleScaleAnim = useRef(new Animated.Value(0)).current;

  const circleSize = Math.ceil(Math.sqrt(width * width + height * height)) + 64;

  useEffect(() => {
    if (variant !== 'app') {
      return;
    }

    circleScaleAnim.setValue(0);
    Animated.timing(circleScaleAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [circleScaleAnim, variant]);

  useEffect(() => {
    if (variant !== 'app' || !exiting) {
      return;
    }

    circleScaleAnim.stopAnimation();
    Animated.timing(circleScaleAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        onExitComplete?.();
      }
    });
  }, [circleScaleAnim, exiting, onExitComplete, variant]);

  if (variant === 'app') {
    return (
      <View style={styles.appContainer} pointerEvents="none">
        <StatusBar barStyle="light-content" backgroundColor={colors.accent} />
        <Animated.View
          style={[
            styles.circleWipe,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              transform: [{scale: circleScaleAnim}],
            },
          ]}>
          <View style={styles.brandShell}>
            <View style={styles.logo}>
              <Image
                source={require('../../../assets/icon.png')}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.brandName}>{title ?? 'DODO'}</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
      gap: 5,
    },
    appContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    circleWipe: {
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    brandShell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 148,
      height: 148,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      borderRadius: 99,
    },
    brandName: {
      fontSize: 34,
      fontFamily: fonts.bodyBold,
      color: '#fff',
      textTransform: 'uppercase',
    },
    inlineLabel: {
      fontSize: 13,
      fontFamily: fonts.bodyBold,
      color: c.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  });
