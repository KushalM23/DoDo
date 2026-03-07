import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import {ThemeColors} from '../theme/ThemeProvider';

export function BottomGradient({colors}: {colors: ThemeColors}) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.background + '00', colors.background, colors.background]}
      locations={[0, 0.75, 1]}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 220, // taller gradient
        zIndex: 10,
      }}
    />
  );
}
