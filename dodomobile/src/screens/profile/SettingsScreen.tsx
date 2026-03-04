import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAlert} from '../../state/AlertContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AppIcon} from '../../components/AppIcon';
import {useAuth} from '../../state/AuthContext';
import {usePreferences} from '../../state/PreferencesContext';
import {changePassword, deleteAccount} from '../../services/api';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {spacing, radii, fontSize} from '../../theme/colors';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {CustomModal} from '../../components/CustomModal';

/* ─── Pill Toggle (matches floating navbar style) ─────────── */

function PillToggle<T extends string>({
  value,
  options,
  onChange,
  colors,
}: {
  value: T;
  options: {value: T; label: string; icon?: string}[];
  onChange: (next: T) => void;
  colors: ThemeColors;
}) {
  const activeIdx = options.findIndex(o => o.value === value);
  const safeIdx = activeIdx >= 0 ? activeIdx : 0;
  const pillLeft = useRef(
    new Animated.Value(safeIdx * (1 / options.length) * 100),
  ).current;

  useEffect(() => {
    Animated.spring(pillLeft, {
      toValue: safeIdx * (1 / options.length) * 100,
      useNativeDriver: false,
      tension: 70,
      friction: 11,
    }).start();
  }, [safeIdx, options.length, pillLeft]);

  function handleSelect(next: T, idx: number) {
    Animated.spring(pillLeft, {
      toValue: idx * (1 / options.length) * 100,
      useNativeDriver: false,
      tension: 70,
      friction: 11,
    }).start();
    onChange(next);
  }

  const widthPct = `${100 / options.length}%` as `${number}%`;

  return (
    <View style={{marginBottom: 20}}>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 28,
          backgroundColor: colors.surface,
          padding: 4,
          position: 'relative',
          overflow: 'hidden',
        }}>
        {/* Sliding pill background */}
        <View
          style={{position: 'absolute', top: 4, left: 4, right: 4, bottom: 4}}>
          <Animated.View
            style={{
              height: '100%',
              width: widthPct,
              left: pillLeft.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              borderRadius: 24,
              backgroundColor: colors.accent,
            }}
          />
        </View>

        {/* Option buttons */}
        {options.map((option, idx) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                gap: 6,
                zIndex: 1,
              }}
              onPress={() => handleSelect(option.value, idx)}>
              {option.icon ? (
                <AppIcon
                  name={option.icon as any}
                  size={14}
                  color={active ? '#fff' : colors.mutedText}
                />
              ) : null}
              <Text
                style={{
                  color: active ? '#fff' : colors.mutedText,
                  fontSize: fontSize.sm,
                  fontFamily: fonts.bodyBold,
                }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Main ─────────────────────────────────────────────────── */

export function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {signOut} = useAuth();
  const {
    preferences,
    setDarkMode,
    setDateFormat,
    setTimeFormat,
    resetPreferences,
  } = usePreferences();

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handlePasswordChange() {
    if (passwordNew.length < 6) {
      showAlert(
        'Invalid password',
        'New password must be at least 6 characters.',
      );
      return;
    }
    if (passwordNew !== passwordConfirm) {
      showAlert(
        "Passwords don't match",
        'New password and confirm password must match.',
      );
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordNew);
      setPasswordCurrent('');
      setPasswordNew('');
      setPasswordConfirm('');
      setPasswordModalVisible(false);
      showAlert('Password updated', 'Your password was changed successfully.');
    } catch (error) {
      showAlert(
        'Change failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setChangingPassword(false);
    }
  }

  function openPasswordModal() {
    setPasswordCurrent('');
    setPasswordNew('');
    setPasswordConfirm('');
    setPasswordModalVisible(true);
  }

  function openDeleteModal() {
    setDeletePassword('');
    setDeleteModalVisible(true);
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      showAlert(
        'Password required',
        'Please enter your password to delete your account.',
      );
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
    } catch (error) {
      showAlert(
        'Delete failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <AppIcon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{width: 22}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            marginTop: 24,
          }}>
          <Text style={[styles.sectionTitle, {marginTop: 0, marginBottom: 0}]}>
            Preferences
          </Text>
          <Pressable onPress={() => void resetPreferences()} hitSlop={12}>
            <AppIcon name="rotate-ccw" size={20} color={colors.text} />
          </Pressable>
        </View>

        <PillToggle
          value={preferences.darkMode ? 'dark' : 'light'}
          colors={colors}
          options={[
            {value: 'light', label: 'Light', icon: 'sun'},
            {value: 'dark', label: 'Dark', icon: 'moon'},
          ]}
          onChange={next => {
            void setDarkMode(next === 'dark');
          }}
        />

        <PillToggle
          value={preferences.dateFormat}
          colors={colors}
          options={[
            {value: 'eu', label: 'DD/MM/YYYY'},
            {value: 'us', label: 'MM/DD/YYYY'},
          ]}
          onChange={next => {
            void setDateFormat(next);
          }}
        />

        <PillToggle
          value={preferences.timeFormat}
          colors={colors}
          options={[
            {value: '12h', label: '12-hour'},
            {value: '24h', label: '24-hour'},
          ]}
          onChange={next => {
            void setTimeFormat(next);
          }}
        />
        <Text style={styles.sectionTitle}>Account</Text>

        {/* Password change — no card background */}
        <View style={styles.accountSection}>
          <Pressable
            style={[styles.actionBtn, styles.logoutBtn]}
            onPress={() => void signOut()}>
            <AppIcon name="log-out" size={14} color={colors.text} />
            <Text style={styles.actionText}>Logout</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.passwordBtn]}
            onPress={openPasswordModal}>
            <AppIcon name="key-round" size={14} color={colors.text} />
            <Text style={[styles.actionText, {color: colors.text}]}>
              Change password
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={openDeleteModal}>
            <AppIcon name="trash-2" size={14} color={colors.text} />
            <Text style={[styles.actionText, {color: colors.text}]}>
              Delete account
            </Text>
          </Pressable>
        </View>

        <CustomModal
          visible={passwordModalVisible}
          title="Change Password"
          onClose={() => setPasswordModalVisible(false)}>
          <TextInput
            style={styles.input}
            placeholder="Current Password"
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={passwordCurrent}
            onChangeText={setPasswordCurrent}
            editable={!changingPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={passwordNew}
            onChangeText={setPasswordNew}
            editable={!changingPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            editable={!changingPassword}
          />
          <Pressable
            style={[
              styles.actionBtn,
              styles.passwordBtn,
              {marginTop: 8},
              changingPassword && styles.disabled,
            ]}
            onPress={handlePasswordChange}
            disabled={changingPassword}>
            <AppIcon name="key-round" size={14} color={colors.text} />
            <Text style={[styles.actionText, {color: colors.text}]}>
              {changingPassword ? 'Saving...' : 'Change password'}
            </Text>
          </Pressable>
        </CustomModal>

        <CustomModal
          visible={deleteModalVisible}
          title="Delete Account"
          onClose={() => setDeleteModalVisible(false)}>
          <Text style={styles.warningText}>
            This permanently deletes your account and all related data. This
            action cannot be undone.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Current Password"
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={deletePassword}
            onChangeText={setDeletePassword}
            editable={!deletingAccount}
          />
          <Pressable
            style={[
              styles.actionBtn,
              styles.deleteBtn,
              {marginTop: 8},
              deletingAccount && styles.disabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}>
            <AppIcon name="trash-2" size={14} color={'#fff'} />
            <Text style={[styles.actionText, {color: '#fff'}]}>
              {deletingAccount ? 'Deleting...' : 'Delete account'}
            </Text>
          </Pressable>
        </CustomModal>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 28,
      paddingVertical: spacing.xs,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 36,
      fontFamily: fonts.heading,
      letterSpacing: -0.5,
    },
    scroll: {
      paddingHorizontal: 28,
      paddingBottom: 100,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontFamily: fonts.headingSemiBold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 24,
      marginBottom: 24,
    },
    accountSection: {
      gap: 10,
    },
    input: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 100,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: fontSize.md,
      fontFamily: fonts.body,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 28,
    },
    actionText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyBold,
    },
    passwordBtn: {
      backgroundColor: colors.surface,
    },
    logoutBtn: {
      backgroundColor: colors.surface,
    },
    deleteBtn: {
      backgroundColor: colors.danger,
    },
    disabled: {
      opacity: 0.6,
    },
    warningText: {
      color: colors.mutedText,
      fontSize: fontSize.md,
      fontFamily: fonts.body,
      marginBottom: spacing.xs,
    },
  });
