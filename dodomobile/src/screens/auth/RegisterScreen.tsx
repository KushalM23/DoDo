import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAlert } from "../../state/AlertContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../state/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { spacing, radii, fontSize } from "../../theme/colors";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!displayName.trim()) {
      showAlert("Display name required", "Please enter your display name.");
      return;
    }

    setBusy(true);
    try {
      await signUp(email, password, displayName);
      showAlert("Registration successful", "If email confirmation is enabled, confirm your email before login.");
      navigation.navigate("Login");
    } catch (error) {
      showAlert("Registration failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Use email + password to get started</Text>

      <TextInput
        placeholder="Display name"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
      />

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={onSubmit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Creating..." : "Create Account"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.goBack()} style={styles.linkContainer}>
        <Text style={styles.linkText}>Already have an account? Back to login</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: spacing.xxl,
    color: colors.mutedText,
    fontSize: fontSize.md + 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: fontSize.md,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
  },
  linkContainer: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
});

