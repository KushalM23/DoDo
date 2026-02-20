import React, { useMemo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./AppIcon";
import { fontSize, spacing } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";

type LoadingScreenProps = {
  variant?: "app" | "screen";
  title?: string;
  iconName?: AppIconName;
};

export function LoadingScreen({ variant = "screen", title, iconName }: LoadingScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === "app") {
    return (
      <View style={styles.container}>
        <View style={styles.brandWrap}>
          <View style={styles.brandIcon}>
            <Image source={require("../../assets/icon.jpg")} style={styles.brandImage} resizeMode="cover" />
          </View>
          <Text style={styles.brandName}>{title ?? "Dodo"}</Text>
        </View>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {iconName ? (
        <View style={styles.screenIconWrap}>
          <AppIcon name={iconName} size={20} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.inlineWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.inlineText}>{title ?? "Loading"}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },
    brandWrap: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    brandIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    brandImage: {
      width: "100%",
      height: "100%",
    },
    brandName: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    inlineWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    screenIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 2,
    },
    inlineText: {
      color: colors.mutedText,
      fontSize: fontSize.sm,
      fontWeight: "600",
    },
  });
