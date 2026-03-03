/**
 * LoginScreen — Object-based, physical, minimal.
 * One hero object (the brand mark + big title),
 * One primary action (sign in slab),
 * Inputs are objects embedded into the space.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAlert } from "../../state/AlertContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../state/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { type ThemeColors, useThemeColors } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/fonts";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  const btnScale = useRef(new Animated.Value(1)).current;
  const brandScale = useRef(new Animated.Value(1)).current;

  // Brand pulse on mount
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.spring(brandScale, { toValue: 1.04, useNativeDriver: true, speed: 1, bounciness: 0 }),
        Animated.spring(brandScale, { toValue: 1, useNativeDriver: true, speed: 1, bounciness: 0 }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [brandScale]);

  async function onSubmit() {
    setBusy(true);
    try { await signIn(email, password); }
    catch (e) { showAlert("Login failed", e instanceof Error ? e.message : "Unknown error"); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand hero object */}
        <View style={styles.heroSection}>
          <Animated.View style={[styles.brandMark, { transform: [{ scale: brandScale }] }]}>
            <View style={styles.brandDot} />
          </Animated.View>
          <Text style={styles.brandName}>dodo</Text>
          <Text style={styles.brandTagline}>get things done.</Text>
        </View>

        {/* Input objects */}
        <View style={styles.fields}>
          <View style={[styles.field, focused === "email" && styles.fieldFocused]}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedText}
              style={styles.fieldInput}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
            />
          </View>

          <View style={[styles.field, focused === "password" && styles.fieldFocused]}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.mutedText}
              style={styles.fieldInput}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
            />
          </View>
        </View>

        {/* CTA slab */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            style={[styles.signInBtn, busy && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={busy}
            onPressIn={() => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()}
            onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
          >
            <Text style={styles.signInText}>{busy ? "Signing in…" : "Sign In"}</Text>
          </Pressable>
        </Animated.View>

        <Pressable style={styles.register} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.registerText}>No account? </Text>
          <Text style={styles.registerLink}>Create one →</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 80,
      paddingBottom: 48,
      justifyContent: "space-between",
    },
    heroSection: { alignItems: "flex-start", gap: 10 },
    brandMark: {
      width: 64, height: 64, borderRadius: 22,
      backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center",
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5, shadowRadius: 24,
      elevation: 12,
      marginBottom: 8,
    },
    brandDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
    brandName: {
      fontSize: 72, fontWeight: "900", fontFamily: fonts.heading, color: c.text,
      letterSpacing: -4, lineHeight: 76,
    },
    brandTagline: {
      fontSize: 18, fontWeight: "600", color: c.mutedText,
      fontFamily: fonts.bodySemiBold,
      letterSpacing: -0.3, marginTop: -4,
    },
    fields: { gap: 12, marginTop: 40 },
    field: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 14,
    },
    fieldFocused: {
      borderColor: c.accent,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 3,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: c.mutedText,
      textTransform: "uppercase",
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    fieldInput: {
      fontSize: 18, fontWeight: "600", color: c.text, fontFamily: fonts.bodySemiBold,
    },
    signInBtn: {
      backgroundColor: c.accent,
      borderRadius: 22,
      paddingVertical: 20,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 32,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 10,
    },
    signInText: { color: "#fff", fontSize: 20, fontWeight: "800", fontFamily: fonts.bodyBold, letterSpacing: -0.3 },
    register: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
    registerText: { color: c.mutedText, fontSize: 15, fontFamily: fonts.body },
    registerLink: { color: c.accent, fontSize: 15, fontWeight: "700", fontFamily: fonts.bodyBold },
  });
