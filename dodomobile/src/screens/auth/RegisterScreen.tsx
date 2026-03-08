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
import {fontSize, radii, spacing} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({navigation}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {signUp} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'name' | 'email' | 'password' | null>(
    null,
  );
  const btnScale = useRef(new Animated.Value(1)).current;

  async function onSubmit() {
    if (!name.trim()) {
      showAlert('Name required', 'Please enter your name.');
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password, name);
      showAlert('Done! Check your email', 'Confirm your account then sign in.');
      navigation.navigate('Login');
    } catch (e) {
      showAlert(
        'Registration failed',
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

            <View style={styles.headlineBlock}>
              <Text style={styles.screenTitle}>Create Account</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.fields}>
              {(['name', 'email', 'password'] as const).map(field => (
                <View key={field} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    {field === 'name'
                      ? 'Your Name'
                      : field === 'email'
                        ? 'Email'
                        : 'Password'}
                  </Text>
                  {field === 'password' ? (
                    <View style={styles.passwordField}>
                      <TextInput
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="default"
                        placeholder="Create a password"
                        placeholderTextColor={colors.mutedText}
                        style={styles.passwordInput}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocused(field)}
                        onBlur={() => setFocused(null)}
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
                  ) : (
                    <TextInput
                      secureTextEntry={false}
                      autoCapitalize={field === 'name' ? 'words' : 'none'}
                      autoCorrect={false}
                      keyboardType={
                        field === 'email' ? 'email-address' : 'default'
                      }
                      placeholder={field === 'name' ? 'Alex' : 'you@example.com'}
                      placeholderTextColor={colors.mutedText}
                      style={[
                        styles.fieldInput,
                        focused === field && styles.fieldInputFocused,
                      ]}
                      value={field === 'name' ? name : email}
                      onChangeText={field === 'name' ? setName : setEmail}
                      onFocus={() => setFocused(field)}
                      onBlur={() => setFocused(null)}
                    />
                  )}
                </View>
              ))}
            </View>

            <Animated.View
              style={[
                styles.primaryActionWrap,
                {transform: [{scale: btnScale}]},
              ]}>
              <Pressable
                style={[styles.createBtn, busy && styles.buttonDisabled]}
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
                <Text style={styles.createText}>
                  {busy ? 'Creating...' : 'Create Account'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Already have an account</Text>
            <AppIcon name="chevron-left" size={18} color={colors.text} />
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
      gap: spacing.sm,
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
    brandTagline: {
      color: c.mutedText,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyMedium,
    },
    headlineBlock: {},
    screenTitle: {
      color: c.text,
      fontSize: fontSize.xl,
      fontFamily: fonts.heading,
      letterSpacing: -0.6,
      lineHeight: 36,
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
      fontFamily: fonts.bodyBold,
      textTransform: 'uppercase',
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
    fieldInputFocused: {
      borderColor: c.accent,
      shadowColor: c.accent,
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 3,
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
    primaryActionWrap: {marginTop: spacing.xs},
    createBtn: {
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
    createText: {
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
