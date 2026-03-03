import React, { useRef, useMemo, useEffect } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, radii, fontSize } from "../theme/colors";
import { type ThemeColors, useThemeColors } from "../theme/ThemeProvider";

export type AlertButton = {
    text: string;
    style?: "default" | "cancel" | "destructive";
    onPress?: () => void;
};

type CustomAlertProps = {
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    onDismiss: () => void;
};

export function CustomAlert({ visible, title, message, buttons, onDismiss }: CustomAlertProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 250 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, damping: 18, stiffness: 250 }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
            ]).start();
        }
    }, [visible, scaleAnim, opacityAnim]);

    const resolvedButtons: AlertButton[] =
        buttons && buttons.length > 0 ? buttons : [{ text: "OK", style: "default" }];

    function handlePress(button: AlertButton) {
        onDismiss();
        button.onPress?.();
    }

    return (
        <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
            <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                <Animated.View style={[styles.popup, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    {/* Orange accent line at top */}
                    <View style={styles.accentBar} />

                    <View style={styles.body}>
                        <Text style={styles.title}>{title}</Text>
                        {message ? <Text style={styles.message}>{message}</Text> : null}
                    </View>

                    <View style={styles.buttonRow}>
                        {resolvedButtons.map((btn, index) => {
                            const isDestructive = btn.style === "destructive";
                            const isCancel = btn.style === "cancel";
                            const isDefault = !isDestructive && !isCancel;
                            return (
                                <Pressable
                                    key={`${btn.text}_${index}`}
                                    style={[
                                        styles.button,
                                        isDefault && styles.defaultButton,
                                        isCancel && styles.cancelButton,
                                        isDestructive && styles.destructiveButton,
                                    ]}
                                    onPress={() => handlePress(btn)}
                                >
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            isDefault && styles.defaultText,
                                            isCancel && styles.cancelText,
                                            isDestructive && styles.destructiveText,
                                        ]}
                                    >
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
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.sm,
        },
        popup: {
            width: "100%",
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            overflow: "hidden",
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 1,
            shadowRadius: 40,
            elevation: 20,
        },
        accentBar: {
            height: 4,
            backgroundColor: colors.accent,
        },
        body: {
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: "800",
            letterSpacing: -0.5,
            marginBottom: 8,
        },
        message: {
            color: colors.mutedText,
            fontSize: fontSize.md,
            lineHeight: 22,
        },
        buttonRow: {
            flexDirection: "row",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.sm,
            paddingTop: spacing.xs,
        },
        button: {
            flex: 1,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
        },
        defaultButton: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
        },
        cancelButton: {
            backgroundColor: colors.surfaceLight,
            borderColor: colors.border,
        },
        destructiveButton: {
            backgroundColor: colors.dangerLight,
            borderColor: colors.danger,
        },
        buttonText: {
            fontSize: fontSize.sm,
            fontWeight: "800",
            letterSpacing: -0.2,
        },
        defaultText: {
            color: "#fff",
        },
        cancelText: {
            color: colors.textSecondary,
        },
        destructiveText: {
            color: colors.danger,
        },
    });
