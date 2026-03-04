import React, {useMemo, useRef, useState} from 'react';
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
} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useAuth} from '../../state/AuthContext';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {fonts} from '../../theme/fonts';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({navigation}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {signUp} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>
          <Text style={styles.headline}>new here?</Text>
          <Text style={styles.tagline}>let's set you up.</Text>
        </View>

        <View style={styles.fields}>
          {(['name', 'email', 'password'] as const).map(f => (
            <View
              key={f}
              style={[styles.field, focused === f && styles.fieldFocused]}>
              <Text style={styles.fieldLabel}>
                {f === 'name'
                  ? 'Your Name'
                  : f === 'email'
                  ? 'Email'
                  : 'Password'}
              </Text>
              <TextInput
                secureTextEntry={f === 'password'}
                autoCapitalize={f === 'name' ? 'words' : 'none'}
                keyboardType={f === 'email' ? 'email-address' : 'default'}
                placeholder={
                  f === 'name'
                    ? 'Alex'
                    : f === 'email'
                    ? 'you@example.com'
                    : '••••••••'
                }
                placeholderTextColor={colors.mutedText}
                style={styles.fieldInput}
                value={f === 'name' ? name : f === 'email' ? email : password}
                onChangeText={
                  f === 'name'
                    ? setName
                    : f === 'email'
                    ? setEmail
                    : setPassword
                }
                onFocus={() => setFocused(f)}
                onBlur={() => setFocused(null)}
              />
            </View>
          ))}
        </View>

        <Animated.View style={{transform: [{scale: btnScale}]}}>
          <Pressable
            style={[styles.createBtn, busy && {opacity: 0.7}]}
            onPress={onSubmit}
            disabled={busy}
            onPressIn={() =>
              Animated.spring(btnScale, {
                toValue: 0.96,
                useNativeDriver: true,
                speed: 40,
              }).start()
            }
            onPressOut={() =>
              Animated.spring(btnScale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 8,
              }).start()
            }>
            <Text style={styles.createText}>
              {busy ? 'Creating…' : 'Create Account'}
            </Text>
          </Pressable>
        </Animated.View>

        <Pressable style={styles.login} onPress={() => navigation.goBack()}>
          <Text style={styles.loginText}>Already have one? </Text>
          <Text style={styles.loginLink}>Sign in →</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: c.background},
    content: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 60,
      paddingBottom: 48,
      justifyContent: 'space-between',
    },
    heroSection: {gap: 6, marginBottom: 8},
    backBtn: {marginBottom: 16},
    backText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.mutedText,
      fontFamily: fonts.bodySemiBold,
    },
    headline: {
      fontSize: 64,
      fontWeight: '900',
      fontFamily: fonts.heading,
      color: c.text,
      letterSpacing: -3.5,
      lineHeight: 68,
    },
    tagline: {
      fontSize: 18,
      fontWeight: '600',
      color: c.mutedText,
      fontFamily: fonts.bodySemiBold,
      letterSpacing: -0.3,
    },
    fields: {gap: 12, marginTop: 32},
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
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 3,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.mutedText,
      fontFamily: fonts.bodyBold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    fieldInput: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
      fontFamily: fonts.bodySemiBold,
    },
    createBtn: {
      backgroundColor: c.accent,
      borderRadius: 22,
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
      shadowColor: c.accent,
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 10,
    },
    createText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '800',
      fontFamily: fonts.bodyBold,
      letterSpacing: -0.3,
    },
    login: {flexDirection: 'row', justifyContent: 'center', marginTop: 24},
    loginText: {color: c.mutedText, fontSize: 15, fontFamily: fonts.body},
    loginLink: {
      color: c.accent,
      fontSize: 15,
      fontWeight: '700',
      fontFamily: fonts.bodyBold,
    },
  });
