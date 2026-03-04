import React, {useMemo, useEffect, useRef} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import {AppIcon, AppIconName} from './AppIcon';
import {spacing, radii, fontSize} from '../theme/colors';
import {ThemeColors, useThemeColors} from '../theme/ThemeProvider';
import {fonts} from '../theme/fonts';

export type FormTab = {
  id: string;
  icon?: string;
  valueDisplay?: string;
};

type FormPopupProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  submitIcon?: string;

  nameValue: string;
  onNameChange: (text: string) => void;
  namePlaceholder: string;

  showNotes?: boolean;
  notesValue?: string;
  onNotesChange?: (text: string) => void;
  notesPlaceholder?: string;

  tabs: FormTab[];
  activeTab: string;
  onTabChange: (id: string) => void;

  children: React.ReactNode;
};

export function FormPopup({
  visible,
  title,
  onCancel,
  onSubmit,
  busy,
  submitLabel,
  submitIcon = 'plus',
  nameValue,
  onNameChange,
  namePlaceholder,
  showNotes,
  notesValue,
  onNotesChange,
  notesPlaceholder,
  tabs,
  activeTab,
  onTabChange,
  children,
}: FormPopupProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={styles.popup} onPress={() => {}}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.heading}>{title}</Text>
              <Pressable onPress={onCancel} hitSlop={12}>
                <AppIcon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            {/* Inputs */}
            <View style={styles.inputsSection}>
              <TextInput
                style={styles.nameInput}
                placeholder={namePlaceholder}
                placeholderTextColor={colors.mutedText}
                value={nameValue}
                onChangeText={onNameChange}
                autoFocus
                returnKeyType={showNotes ? 'next' : 'done'}
                multiline={false}
              />
              {showNotes && (
                <TextInput
                  style={styles.notesInput}
                  placeholder={notesPlaceholder || 'Add notes (optional)'}
                  placeholderTextColor={colors.mutedText}
                  value={notesValue}
                  onChangeText={onNotesChange}
                  multiline
                  textAlignVertical="top"
                />
              )}
            </View>

            {/* Tabs Row */}
            <View style={styles.tabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScroll}>
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                      onPress={() => onTabChange(tab.id)}>
                      {tab.icon && (
                        <AppIcon
                          name={tab.icon as AppIconName}
                          size={16}
                          color={isActive ? colors.text : colors.mutedText}
                        />
                      )}
                      {tab.valueDisplay ? (
                        <Text
                          style={[
                            styles.tabValue,
                            isActive && styles.tabValueActive,
                          ]}>
                          {tab.valueDisplay}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.contentArea}>
                {children}
              </View>
            </ScrollView>

            <View style={styles.submitRow}>
              <Pressable
                onPress={onSubmit}
                style={[styles.submitBtn, (busy || !nameValue.trim()) && styles.disabled]}
                disabled={busy || !nameValue.trim()}>
                <AppIcon name="plus" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>{busy ? 'Adding...' : submitLabel}</Text>
              </Pressable>
            </View>

          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
    popup: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      width: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: -4},
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    heading: {
      fontSize: fontSize.xxl,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -0.5,
    },
    submitRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    submitBtn: {
      flexDirection: 'row',
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      marginBottom: spacing.xxl,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitBtnText: {
      color: '#fff',
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.md,
    },
    disabled: {
      opacity: 0.5,
    },
    inputsSection: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    nameInput: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 60,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: fontSize.md,
      fontFamily: fonts.bodyMedium,
    },
    notesInput: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyMedium,
      height: 60,
    },
    tabsWrapper: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsScroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: 12,
      gap: 6,
    },
    tabBtnActive: {
      backgroundColor: colors.accent,
    },
    tabValue: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.sm,
      color: colors.mutedText,
    },
    tabValueActive: {
      color: colors.text,
    },
    contentArea: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      minHeight: 440,
    },
  });
