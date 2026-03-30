import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RichEditor, actions} from 'react-native-pell-rich-editor';
import {AppIcon} from '../../components/AppIcon';
import {useAlert} from '../../state/AlertContext';
import {useNotes} from '../../state/NotesContext';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;
type AlignmentMode = 'left' | 'center' | 'right';
const ALIGNMENT_CYCLE = [
  {action: actions.alignLeft, mode: 'left' as AlignmentMode},
  {action: actions.alignCenter, mode: 'center' as AlignmentMode},
  {action: actions.alignRight, mode: 'right' as AlignmentMode},
] as const;

function toEditorFontScale(sizePx: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (sizePx <= 11) {
    return 1;
  }
  if (sizePx <= 13) {
    return 2;
  }
  if (sizePx <= 17) {
    return 3;
  }
  if (sizePx <= 21) {
    return 4;
  }
  if (sizePx <= 27) {
    return 5;
  }
  if (sizePx <= 36) {
    return 6;
  }
  return 7;
}

function AlignmentGlyph({mode, color}: {mode: AlignmentMode; color: string}) {
  const lineAlign =
    mode === 'left' ? 'flex-start' : mode === 'center' ? 'center' : 'flex-end';

  return (
    <View style={{width: 18, gap: 2}}>
      <View
        style={{
          width: 14,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: 10,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: 12,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function initialRichContent(contentRich: string | null | undefined): string {
  if (contentRich && contentRich.trim()) {
    return contentRich;
  }
  return '<div style="font-size:20px"></div>';
}

function applyEditorAction(editor: RichEditor | null, action: actions): void {
  if (!editor) {
    return;
  }

  editor.focusContentEditor();
  editor.sendAction(action, 'result');
}

export function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const route = useRoute<RouteProp<RootStackParamList, 'NoteEditor'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {notes, updateNote, removeNote, syncNow} = useNotes();

  const note = notes.find(item => item.id === route.params.noteId) ?? null;

  const editorRef = useRef<RichEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizingRef = useRef(false);
  const initializedRef = useRef(false);
  const saveErrorShownRef = useRef(false);
  const lastSavedSignatureRef = useRef('');
  const headingRef = useRef('');
  const richRef = useRef('');
  const plainRef = useRef('');

  const [headingDraft, setHeadingDraft] = useState('');
  const [contentRichDraft, setContentRichDraft] = useState('');
  const [contentPlainDraft, setContentPlainDraft] = useState('');
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [alignmentIndex, setAlignmentIndex] = useState(0);
  const [activeActions, setActiveActions] = useState<string[]>([]);
  const [editorReady, setEditorReady] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!note) {
      return;
    }

    const rich = initialRichContent(note.contentRich);
    setHeadingDraft(note.heading ?? '');
    setContentRichDraft(rich);
    setContentPlainDraft(note.contentPlain ?? '');
    setFontSize(20);
    setActiveActions([]);
    setEditorReady(false);

    headingRef.current = note.heading ?? '';
    richRef.current = rich;
    plainRef.current = note.contentPlain ?? '';
    lastSavedSignatureRef.current = [
      headingRef.current,
      richRef.current,
      plainRef.current,
    ].join('|');
    saveErrorShownRef.current = false;
    initializedRef.current = true;
    finalizingRef.current = false;
  }, [note?.id]);

  useEffect(() => {
    headingRef.current = headingDraft;
  }, [headingDraft]);

  useEffect(() => {
    richRef.current = contentRichDraft;
  }, [contentRichDraft]);

  useEffect(() => {
    plainRef.current = contentPlainDraft;
  }, [contentPlainDraft]);

  const persistDraft = useCallback(
    async (syncAfterSave: boolean) => {
      if (!note) {
        return;
      }

      const heading = headingRef.current;
      const contentRich = initialRichContent(richRef.current);
      const contentPlain = plainRef.current;
      const signature = [heading, contentRich, contentPlain].join('|');

      if (signature === lastSavedSignatureRef.current) {
        if (syncAfterSave) {
          await syncNow();
        }
        return;
      }

      try {
        const updated = await updateNote(
          note.id,
          {
            heading,
            contentRich,
            contentPlain,
          },
          {sync: false},
        );

        if (updated) {
          lastSavedSignatureRef.current = signature;
          saveErrorShownRef.current = false;
        }

        if (syncAfterSave) {
          await syncNow();
        }
      } catch (error) {
        if (!saveErrorShownRef.current) {
          showAlert(
            'Autosave failed',
            error instanceof Error
              ? error.message
              : 'Unable to save this note right now.',
          );
          saveErrorShownRef.current = true;
        }
      }
    },
    [note, showAlert, syncNow, updateNote],
  );

  const finalizeOnExit = useCallback(async () => {
    if (!note || finalizingRef.current) {
      return;
    }

    finalizingRef.current = true;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const headingEmpty = headingRef.current.trim().length === 0;
    const contentEmpty = plainRef.current.trim().length === 0;

    if (headingEmpty && contentEmpty) {
      await removeNote(note.id);
      return;
    }

    await persistDraft(true);
  }, [note, persistDraft, removeNote]);

  useEffect(() => {
    if (!note || !initializedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = setTimeout(() => {
      void persistDraft(false);
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [contentPlainDraft, contentRichDraft, headingDraft, note, persistDraft]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      void finalizeOnExit();
    });

    return unsubscribe;
  }, [finalizeOnExit, navigation]);

  useEffect(() => {
    return () => {
      void finalizeOnExit();
    };
  }, [finalizeOnExit]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!editorReady || !editorRef.current) {
      return;
    }

    editorRef.current.registerToolbar(items => {
      const normalized = items
        .map(item => (typeof item === 'string' ? item : item?.type))
        .filter(Boolean) as string[];

      setActiveActions(normalized);

      if (normalized.includes(actions.alignCenter)) {
        setAlignmentIndex(1);
      } else if (normalized.includes(actions.alignRight)) {
        setAlignmentIndex(2);
      } else {
        setAlignmentIndex(0);
      }
    });
  }, [editorReady]);

  useEffect(() => {
    if (!editorReady) {
      return;
    }

    const timer = setTimeout(() => {
      editorRef.current?.focusContentEditor();
    }, 180);

    return () => clearTimeout(timer);
  }, [editorReady, note?.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!editorReady) {
        return;
      }

      setTimeout(() => {
        editorRef.current?.focusContentEditor();
      }, 120);
    });

    return unsubscribe;
  }, [editorReady, navigation]);

  function handleBackPress() {
    navigation.goBack();
    void finalizeOnExit();
  }

  function applyFontSize(size: number) {
    setFontSize(size);
    setFontMenuOpen(false);

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const scale = toEditorFontScale(size);
    editor.focusContentEditor();
    editor.setFontSize(scale);
    editor.command(`
      $.execCommand('styleWithCSS', false, true);
      $.execCommand('fontSize', false, '${scale}');
      var nodes = $.querySelectorAll('font[size="${scale}"]');
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        node.removeAttribute('size');
        node.style.fontSize = '${size}px';
      }
      var root = $.querySelector('#editor');
      if (root) {
        root.style.fontSize = '${size}px';
      }
    `);
  }

  function cycleAlignment() {
    const nextIndex = (alignmentIndex + 1) % ALIGNMENT_CYCLE.length;
    setAlignmentIndex(nextIndex);
    applyEditorAction(editorRef.current, ALIGNMENT_CYCLE[nextIndex].action);
  }

  function isActionActive(action: actions): boolean {
    return activeActions.includes(action);
  }

  function confirmDelete() {
    if (!note) {
      return;
    }

    showAlert('Delete note?', 'This action cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          finalizingRef.current = true;
          await removeNote(note.id);
          navigation.goBack();
        },
      },
    ]);
  }

  async function togglePinned() {
    if (!note) {
      return;
    }

    await updateNote(note.id, {
      isPinned: !note.isPinned,
      pinnedAt: note.isPinned ? null : new Date().toISOString(),
    });
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <AppIcon name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.notFoundTitle}>Note</Text>
          <View style={styles.headerActionsSpacer} />
        </View>
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundText}>Note not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toolbarBottom =
    keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(12, insets.bottom + 6);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.editorWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable onPress={handleBackPress} hitSlop={12}>
            <AppIcon name="chevron-left" size={24} color={colors.text} />
          </Pressable>

          <TextInput
            value={headingDraft}
            onChangeText={setHeadingDraft}
            placeholder="Title"
            placeholderTextColor={colors.mutedText}
            style={styles.headerTitleInput}
            selectionColor={colors.accent}
            numberOfLines={1}
          />

          <View style={styles.headerActions}>
            <Pressable onPress={() => void togglePinned()} hitSlop={12}>
              <AppIcon
                name="pin"
                size={18}
                color={note.isPinned ? colors.accent : colors.mutedText}
              />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <AppIcon name="trash-2" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.richEditorContainer}>
          <RichEditor
            key={note.id}
            ref={editorRef}
            editorInitializedCallback={() => setEditorReady(true)}
            initialContentHTML={contentRichDraft}
            placeholder="Start writing..."
            style={styles.richEditor}
            useContainer={false}
            editorStyle={{
              backgroundColor: colors.background,
              color: colors.text,
              caretColor: colors.accent,
              placeholderColor: colors.mutedText,
              contentCSSText: `
                font-family: ${fonts.bodyMedium};
                font-size: 20px;
                line-height: 1.55;
                padding: 0 4px;
              `,
            }}
            onChange={html => {
              setContentRichDraft(html);
              setContentPlainDraft(htmlToPlain(html));
            }}
          />
        </View>
      </KeyboardAvoidingView>

      <View style={[styles.toolbarFloatingWrap, {bottom: toolbarBottom}]}>
        {fontMenuOpen ? (
          <View style={styles.fontMenuPopover}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.fontMenuList}>
              {FONT_SIZES.map(size => (
                <Pressable
                  key={size}
                  onPress={() => applyFontSize(size)}
                  style={[
                    styles.fontItem,
                    size === fontSize && {
                      backgroundColor: colors.accent,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.fontItemText,
                      size === fontSize && {color: '#fff'},
                    ]}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.toolbarShell}>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}>
            <Pressable
              onPress={() => setFontMenuOpen(open => !open)}
              style={styles.fontSizeButton}>
              <Text style={styles.toolText}>{fontSize}</Text>
              <AppIcon name="chevron-down" size={14} color={colors.mutedText} />
            </Pressable>

            <View style={styles.toolbarDivider} />

            <Pressable
              onPress={() =>
                applyEditorAction(editorRef.current, actions.setBold)
              }
              style={[
                styles.toolIconButton,
                isActionActive(actions.setBold) && styles.toolIconButtonActive,
              ]}>
              <Text
                style={[
                  styles.toolText,
                  isActionActive(actions.setBold) && styles.toolTextActive,
                ]}>
                B
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                applyEditorAction(editorRef.current, actions.setItalic)
              }
              style={[
                styles.toolIconButton,
                isActionActive(actions.setItalic) &&
                  styles.toolIconButtonActive,
              ]}>
              <Text
                style={[
                  styles.toolText,
                  styles.toolItalic,
                  isActionActive(actions.setItalic) && styles.toolTextActive,
                ]}>
                I
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                applyEditorAction(editorRef.current, actions.setUnderline)
              }
              style={[
                styles.toolIconButton,
                isActionActive(actions.setUnderline) &&
                  styles.toolIconButtonActive,
              ]}>
              <Text
                style={[
                  styles.toolText,
                  styles.toolUnderline,
                  isActionActive(actions.setUnderline) && styles.toolTextActive,
                ]}>
                U
              </Text>
            </Pressable>

            <View style={styles.toolbarDivider} />

            <Pressable
              onPress={cycleAlignment}
              style={[
                styles.toolIconButton,
                (isActionActive(actions.alignLeft) ||
                  isActionActive(actions.alignCenter) ||
                  isActionActive(actions.alignRight)) &&
                  styles.toolIconButtonActive,
              ]}>
              <AlignmentGlyph
                mode={ALIGNMENT_CYCLE[alignmentIndex].mode}
                color={
                  isActionActive(actions.alignLeft) ||
                  isActionActive(actions.alignCenter) ||
                  isActionActive(actions.alignRight)
                    ? '#fff'
                    : colors.text
                }
              />
            </Pressable>

            <View style={styles.toolbarDivider} />

            <Pressable
              onPress={() =>
                applyEditorAction(editorRef.current, actions.insertOrderedList)
              }
              style={[
                styles.toolIconButton,
                isActionActive(actions.insertOrderedList) &&
                  styles.toolIconButtonActive,
              ]}>
              <AppIcon
                name="list-ordered"
                size={16}
                color={
                  isActionActive(actions.insertOrderedList)
                    ? '#fff'
                    : colors.text
                }
              />
            </Pressable>
            <Pressable
              onPress={() =>
                applyEditorAction(editorRef.current, actions.insertBulletsList)
              }
              style={[
                styles.toolIconButton,
                isActionActive(actions.insertBulletsList) &&
                  styles.toolIconButtonActive,
              ]}>
              <AppIcon
                name="list"
                size={16}
                color={
                  isActionActive(actions.insertBulletsList)
                    ? '#fff'
                    : colors.text
                }
              />
            </Pressable>
          </ScrollView>
        </View>
      </View>
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
      paddingHorizontal: 12,
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitleInput: {
      flex: 1,
      color: colors.text,
      fontFamily: fonts.heading,
      fontSize: 34,
      letterSpacing: -0.6,
      minHeight: 48,
      paddingVertical: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    headerActionsSpacer: {
      width: 24,
      height: 24,
    },
    editorWrap: {
      flex: 1,
    },
    richEditorContainer: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 96,
    },
    richEditor: {
      flex: 1,
      minHeight: 220,
    },
    toolbarFloatingWrap: {
      position: 'absolute',
      left: 14,
      right: 14,
      zIndex: 40,
    },
    toolbarShell: {
      borderRadius: 18,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowOffset: {width: 0, height: 8},
      shadowRadius: 18,
      elevation: 14,
    },
    toolbarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingRight: 6,
    },
    toolbarDivider: {
      width: StyleSheet.hairlineWidth,
      height: 24,
      marginHorizontal: 6,
      backgroundColor: colors.border,
    },
    fontSizeButton: {
      minWidth: 54,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 2,
      paddingHorizontal: 8,
      backgroundColor: colors.surfaceLight,
    },
    toolIconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolIconButtonActive: {
      backgroundColor: colors.accent,
    },
    toolText: {
      color: colors.text,
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
    },
    toolTextActive: {
      color: '#fff',
    },
    toolItalic: {
      fontFamily: fonts.body,
      fontStyle: 'italic',
    },
    toolUnderline: {
      textDecorationLine: 'underline',
    },
    fontMenuPopover: {
      marginBottom: 8,
      borderRadius: 12,
      padding: 8,
      width: 76,
      maxHeight: 220,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowOffset: {width: 0, height: 6},
      shadowRadius: 14,
      elevation: 9,
    },
    fontMenuList: {
      gap: 4,
    },
    fontItem: {
      width: '100%',
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLight,
      paddingHorizontal: 6,
    },
    fontItemText: {
      color: colors.text,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
    },
    notFoundWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notFoundTitle: {
      color: colors.text,
      fontSize: 22,
      fontFamily: fonts.heading,
    },
    notFoundText: {
      color: colors.text,
      fontSize: 22,
      fontFamily: fonts.heading,
    },
  });
