import React, {useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AppIcon} from '../../components/AppIcon';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {useAlert} from '../../state/AlertContext';
import {useAuth} from '../../state/AuthContext';
import {fontSize, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({navigation}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {signIn} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnScale = useRef(new Animated.Value(1)).current;

  async function onSubmit() {
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      showAlert(
        'Login failed',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <View style={styles.brandRow}>
              <Image
                source={require('../../../assets/icon.jpg')}
                style={styles.logo}
              />
              <View style={styles.brandCopy}>
                <Text style={styles.eyebrow}>DODO</Text>
              </View>
            </View>

            <Text style={styles.screenTitle}>Sign In</Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.fields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedText}
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.mutedText}
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable
                    style={styles.passwordToggleButton}
                    hitSlop={8}
                    onPress={() => setShowPassword(prev => !prev)}>
                    <AppIcon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color={colors.accent}
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            <Animated.View
              style={[
                styles.primaryActionWrap,
                {transform: [{scale: btnScale}]},
              ]}>
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={onSubmit}
                disabled={busy}
                onPressIn={() =>
                  Animated.spring(btnScale, {
                    toValue: 0.98,
                    useNativeDriver: true,
                    speed: 40,
                    bounciness: 0,
                  }).start()
                }
                onPressOut={() =>
                  Animated.spring(btnScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    speed: 24,
                    bounciness: 6,
                  }).start()
                }>
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}>
            <Text style={styles.secondaryButtonText}>Create account</Text>
            <AppIcon name="chevron-right" size={18} color={colors.text} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    keyboardAvoidingView: {flex: 1},
    container: {flex: 1, backgroundColor: c.background},
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      justifyContent: 'center',
      gap: spacing.xl,
    },
    heroSection: {
      gap: spacing.xl,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    logo: {
      width: 56,
      height: 56,
      borderRadius: 28,
      shadowColor: c.accent,
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.25,
      shadowRadius: 18,
      elevation: 8,
    },
    brandCopy: {
      gap: spacing.xs,
    },
    eyebrow: {
      color: c.accent,
      fontSize: fontSize.xxl,
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    screenTitle: {
      color: c.text,
      fontSize: fontSize.xl,
      lineHeight: 36,
      fontFamily: fonts.heading,
      letterSpacing: -0.6,
    },
    panel: {
      padding: spacing.lg,
      gap: spacing.lg,
      shadowColor: c.shadow,
      shadowOffset: {width: 0, height: 12},
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
    },
    fields: {gap: spacing.md},
    fieldGroup: {
      gap: spacing.xs,
    },
    fieldLabel: {
      marginLeft: spacing.sm,
      fontSize: fontSize.xs,
      color: c.mutedText,
      textTransform: 'uppercase',
      fontFamily: fonts.bodyBold,
      letterSpacing: 1.2,
    },
    fieldInput: {
      backgroundColor: c.surfaceLight,
      borderRadius: 60,
      paddingHorizontal: spacing.xl,
      height: 50,
      color: c.text,
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
      textAlignVertical: 'center',
    },
    passwordField: {
      backgroundColor: c.surfaceLight,
      borderRadius: 60,
      paddingLeft: spacing.xl,
      paddingRight: spacing.md,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    passwordInput: {
      flex: 1,
      color: c.text,
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
      textAlignVertical: 'center',
      paddingVertical: 0,
    },
    passwordToggleButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionWrap: {
      marginTop: spacing.xs,
    },
    primaryButton: {
      backgroundColor: c.accent,
      borderRadius: 99,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.3,
      shadowRadius: 18,
      elevation: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontFamily: fonts.bodyBold,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    secondaryButton: {
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    secondaryButtonText: {
      color: c.text,
      fontSize: fontSize.md,
      fontFamily: fonts.bodySemiBold,
    },
  });
