import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "../../components/AppIcon";
import { useAuth } from "../../state/AuthContext";
import { usePreferences } from "../../state/PreferencesContext";
import { changePassword, deleteAccount } from "../../services/api";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { colors, spacing, radii, fontSize } from "../../theme/colors";

function SegmentedControl<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.prefBlock}>
      <Text style={styles.prefLabel}>{title}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();
  const {
    preferences,
    setDarkMode,
    setDateFormat,
    setTimeFormat,
    setWeekStart,
    resetPreferences,
  } = usePreferences();

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handlePasswordChange() {
    const trimmed = newPassword.trim();
    if (trimmed.length < 6) {
      Alert.alert("Invalid password", "Password must be at least 6 characters.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(trimmed);
      setNewPassword("");
      Alert.alert("Password updated", "Your password was changed successfully.");
    } catch (error) {
      Alert.alert("Change failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setChangingPassword(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all related data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <AppIcon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.prefBlock}>
          <View style={styles.themeRow}>
            <View>
              <Text style={styles.prefLabel}>App theme</Text>
            </View>

            <View style={styles.themeToggleTrack}>
              <Pressable
                style={[styles.themeOption, !preferences.darkMode && styles.themeOptionActive]}
                onPress={() => {
                  void setDarkMode(false);
                }}
              >
                <AppIcon name="sun" size={14} color={!preferences.darkMode ? colors.accent : colors.mutedText} />
                <Text style={[styles.themeOptionText, !preferences.darkMode && styles.themeOptionTextActive]}>Light</Text>
              </Pressable>

              <Pressable
                style={[styles.themeOption, preferences.darkMode && styles.themeOptionActive]}
                onPress={() => {
                  void setDarkMode(true);
                }}
              >
                <AppIcon name="moon" size={14} color={preferences.darkMode ? colors.accent : colors.mutedText} />
                <Text style={[styles.themeOptionText, preferences.darkMode && styles.themeOptionTextActive]}>Dark</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <SegmentedControl
          title="Date format"
          value={preferences.dateFormat}
          options={[
            { value: "eu", label: "EU (DD/MM/YYYY)" },
            { value: "us", label: "US (MM/DD/YYYY)" },
          ]}
          onChange={(next) => {
            void setDateFormat(next);
          }}
        />

        <SegmentedControl
          title="Time format"
          value={preferences.timeFormat}
          options={[
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ]}
          onChange={(next) => {
            void setTimeFormat(next);
          }}
        />

        <SegmentedControl
          title="Week start"
          value={preferences.weekStart}
          options={[
            { value: "monday", label: "Monday" },
            { value: "sunday", label: "Sunday" },
          ]}
          onChange={(next) => {
            void setWeekStart(next);
          }}
        />

        <Pressable
          style={styles.resetBtn}
          onPress={() => {
            void resetPreferences();
          }}
        >
          <AppIcon name="rotate-ccw" size={14} color={colors.accent} />
          <Text style={styles.resetText}>Reset preferences</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.accountCard}>
          <Text style={styles.prefLabel}>Change password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Enter new password"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
          <Pressable
            style={[styles.actionBtn, styles.passwordBtn, changingPassword && styles.disabled]}
            onPress={handlePasswordChange}
            disabled={changingPassword}
          >
            <AppIcon name="key-round" size={14} color={colors.accent} />
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {changingPassword ? "Saving..." : "Change password"}
            </Text>
          </Pressable>

          <Pressable style={[styles.actionBtn, styles.logoutBtn]} onPress={() => void signOut()}>
            <AppIcon name="log-out" size={14} color={colors.text} />
            <Text style={styles.actionText}>Logout</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.deleteBtn, deletingAccount && styles.disabled]}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            <AppIcon name="trash-2" size={14} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>
              {deletingAccount ? "Deleting..." : "Delete account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  prefBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  prefLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  prefHint: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    marginTop: -4,
  },
  themeRow: {
    gap: spacing.sm,
  },
  themeToggleTrack: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  themeOptionActive: {
    backgroundColor: colors.accentLight,
  },
  themeOptionText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  themeOptionTextActive: {
    color: colors.accent,
  },
  segmentWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  segmentBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  segmentBtnActive: {
    backgroundColor: colors.accentLight,
  },
  segmentText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  resetText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  accountCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  actionText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  passwordBtn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  logoutBtn: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  deleteBtn: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  disabled: {
    opacity: 0.6,
  },
});
