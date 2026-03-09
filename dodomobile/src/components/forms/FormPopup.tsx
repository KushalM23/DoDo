import React, {useMemo, useRef, useCallback} from 'react';
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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import {AppIcon, AppIconName} from '../AppIcon';
import {spacing, fontSize} from '../../theme/colors';
import {ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {fonts} from '../../theme/fonts';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type FormTab = {
  id: string;
  icon?: string;
  valueDisplay?: string;
  color?: string;
};

type FormPopupProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  nameValue: string;
  onNameChange: (text: string) => void;
  namePlaceholder: string;

  showNotes?: boolean;
  notesValue?: string;
  onNotesChange?: (text: string) => void;
  notesPlaceholder?: string;

  tabs: FormTab[] | FormTab[][];
  activeTab: string;
  onTabChange: (id: string) => void;

  children: React.ReactNode;

  canSubmit?: boolean;
};

const ANIM_CONFIG = {
  duration: 250,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export function FormPopup({
  visible,
  title,
  onCancel,
  onSubmit,
  busy,
  submitLabel,
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
  canSubmit,
}: FormPopupProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);

  const handleTabChange = useCallback(
    (tabId: string) => {
      LayoutAnimation.configureNext(ANIM_CONFIG);
      onTabChange(tabId);
    },
    [onTabChange],
  );

  if (!visible) return null;

  const isMultiRow = tabs.length > 0 && Array.isArray(tabs[0]);
  const rows = isMultiRow ? (tabs as FormTab[][]) : ([tabs] as FormTab[][]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 150)}>
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
                ref={inputRef}
                style={styles.nameInput}
                placeholder={namePlaceholder}
                placeholderTextColor={colors.mutedText}
                value={nameValue}
                onChangeText={onNameChange}
                returnKeyType={showNotes ? 'next' : 'done'}
                multiline={false}
                numberOfLines={1}
                textAlignVertical="center"
                onSubmitEditing={() => {
                  const submittable =
                    canSubmit !== undefined ? canSubmit : !!nameValue.trim();
                  if (submittable && !busy) {
                    onSubmit();
                  }
                }}
                blurOnSubmit={!showNotes}
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
              {rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.tabsRow}>
                  {row.map(tab => {
                    const isActive = activeTab === tab.id;
                    const hasColor = !!tab.color;

                    // When selected: use accent bg (like all other tabs).
                    // When NOT selected but has color: use the custom color bg.
                    // Otherwise: default surfaceLight.
                    const tabBgStyle = isActive
                      ? styles.tabBtnActive
                      : hasColor
                      ? {backgroundColor: tab.color}
                      : undefined;

                    // Icon color: white when active or has custom color, mutedText otherwise
                    const iconColor =
                      isActive || hasColor ? '#fff' : colors.mutedText;

                    return (
                      <Pressable
                        key={tab.id}
                        style={[styles.tabBtn, tabBgStyle]}
                        onPress={() =>
                          handleTabChange(isActive ? '' : tab.id)
                        }>
                        {tab.icon && (
                          <AppIcon
                            name={tab.icon as AppIconName}
                            size={16}
                            color={iconColor}
                          />
                        )}
                        {tab.valueDisplay ? (
                          <Text
                            style={[
                              styles.tabValue,
                              (isActive || hasColor) && styles.tabValueLight,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail">
                            {tab.valueDisplay}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {activeTab !== '' && (
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View style={styles.contentArea}>{children}</View>
              </ScrollView>
            )}

            <View style={styles.submitRow}>
              <Pressable
                onPress={onSubmit}
                style={[
                  styles.submitBtn,
                  (busy || !nameValue.trim()) && styles.disabled,
                ]}
                disabled={busy || !nameValue.trim()}>
                <AppIcon name="plus" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {busy ? 'Adding...' : submitLabel}
                </Text>
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
      backgroundColor: 'rgba(0,0,0,0.9)',
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
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    nameInput: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 60,
      paddingHorizontal: spacing.xl,
      height: 50,
      color: colors.text,
      fontSize: fontSize.lg,
      fontFamily: fonts.heading,
      textAlignVertical: 'center' as const,
    },
    notesInput: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.bodyMedium,
      height: 60,
    },
    tabsWrapper: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 48,
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: 12,
      gap: 6,
    },
    tabBtnActive: {
      backgroundColor: colors.accent,
    },
    tabValue: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.mutedText,
      flexShrink: 1,
    },
    tabValueLight: {
      color: '#fff',
    },
    contentArea: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
  });
