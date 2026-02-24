import React, { useMemo } from "react";
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

    const resolvedButtons: AlertButton[] =
        buttons && buttons.length > 0 ? buttons : [{ text: "OK", style: "default" }];

    function handlePress(button: AlertButton) {
        onDismiss();
        button.onPress?.();
    }

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <Pressable style={styles.popup} onPress={() => { }}>
                    <Text style={styles.title}>{title}</Text>
                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    <View style={styles.buttonRow}>
                        {resolvedButtons.map((btn, index) => {
                            const isDestructive = btn.style === "destructive";
                            const isCancel = btn.style === "cancel";
                            return (
                                <Pressable
                                    key={`${btn.text}_${index}`}
                                    style={[
                                        styles.button,
                                        isDestructive && styles.destructiveButton,
                                        isCancel && styles.cancelButton,
                                        !isDestructive && !isCancel && styles.defaultButton,
                                        resolvedButtons.length === 1 && styles.singleButton,
                                    ]}
                                    onPress={() => handlePress(btn)}
                                >
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            isDestructive && styles.destructiveText,
                                            isCancel && styles.cancelText,
                                            !isDestructive && !isCancel && styles.defaultText,
                                        ]}
                                    >
                                        {btn.text}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.xl,
        },
        popup: {
            width: "100%",
            maxWidth: 340,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.lg,
            fontWeight: "700",
            marginBottom: spacing.sm,
        },
        message: {
            color: colors.mutedText,
            fontSize: fontSize.sm,
            lineHeight: 20,
            marginBottom: spacing.lg,
        },
        buttonRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        button: {
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
        },
        singleButton: {
            flex: 1,
        },
        defaultButton: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
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
            fontWeight: "700",
        },
        defaultText: {
            color: "#fff",
        },
        cancelText: {
            color: colors.mutedText,
        },
        destructiveText: {
            color: colors.danger,
        },
    });
