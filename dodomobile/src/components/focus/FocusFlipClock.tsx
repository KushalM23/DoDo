import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {darkColors, type ThemeColors} from '../../theme/ThemeProvider';

type FocusFlipClockProps = {
  totalSeconds: number;
};

type ClockSection = {
  key: string;
  value: string;
};

function normalizeSeconds(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds)) {
    return 0;
  }

  return Math.max(0, Math.floor(totalSeconds));
}

function buildSections(totalSeconds: number): ClockSection[] {
  const safeSeconds = normalizeSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [
    {key: 'hours', value: String(hours).padStart(2, '0')},
    {key: 'minutes', value: String(minutes).padStart(2, '0')},
    {key: 'seconds', value: String(seconds).padStart(2, '0')},
  ];
}

export function FocusFlipClock({totalSeconds}: FocusFlipClockProps) {
  const colors = darkColors;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sections = useMemo(() => buildSections(totalSeconds), [totalSeconds]);

  return (
    <View accessibilityLabel="Focus timer" style={styles.wrap}>
      <View style={styles.clockRow}>
        {sections.map((section, index) => (
          <React.Fragment key={section.key}>
            <Text style={styles.sectionText}>{section.value}</Text>
            {index < sections.length - 1 ? (
              <Text style={styles.separator}>:</Text>
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginTop: spacing.xl,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xs,
    },
    clockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
    },
    sectionText: {
      color: colors.text,
      fontSize: 48,
      lineHeight: 72,
      fontFamily: fonts.heading,
      letterSpacing: -1.5,
      includeFontPadding: false,
      textAlign: 'center',
      minWidth: 68,
    },
    separator: {
      color: colors.accent,
      fontSize: 32,
      lineHeight: 48,
      fontFamily: fonts.headingSemiBold,
      marginTop: -8,
    },
  });
