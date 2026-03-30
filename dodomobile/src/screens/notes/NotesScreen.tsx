import React, {useMemo, useRef, useState} from 'react';
import {
  Animated,
  type GestureResponderEvent,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BottomGradient} from '../../components/display/BottomGradient';
import {AppIcon} from '../../components/AppIcon';
import {useAlert} from '../../state/AlertContext';
import {useNotes} from '../../state/NotesContext';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import type {Note} from '../../types/note';
import {fonts} from '../../theme/fonts';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LIST_ANIMATION = {
  duration: 220,
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

function deriveHeadingFallback(contentPlain: string): string {
  const normalized = contentPlain.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Untitled';
  }

  const words = normalized.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
}

function NoteCard({
  note,
  selected,
  onPress,
  onLongPress,
  colors,
}: {
  note: Note;
  selected: boolean;
  onPress: () => void;
  onLongPress: (event: GestureResponderEvent) => void;
  colors: ThemeColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const displayHeading =
    note.heading.trim() || deriveHeadingFallback(note.contentPlain);

  return (
    <Animated.View style={[styles.cardWrap, {transform: [{scale}]}]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={220}
        onPressIn={() => {
          Animated.spring(scale, {
            toValue: 0.985,
            speed: 40,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            speed: 20,
            bounciness: 8,
            useNativeDriver: true,
          }).start();
        }}
        style={[
          styles.card,
          {backgroundColor: colors.surface},
          selected && {
            borderWidth: 2,
            borderColor: colors.accent,
            backgroundColor: colors.surfaceLight,
          },
        ]}
        android_ripple={{color: colors.surfaceLight}}>
        <View style={styles.cardHeadingRow}>
          <Text
            numberOfLines={1}
            style={[styles.cardHeading, {color: colors.text}]}>
            {displayHeading}
          </Text>
          {note.isPinned ? (
            <AppIcon name="pin" size={15} color={colors.accent} />
          ) : null}
        </View>
        <Text
          numberOfLines={3}
          style={[styles.cardPreview, {color: colors.mutedText}]}
          ellipsizeMode="tail">
          {note.contentPlain || 'Tap to start writing...'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function NotesScreen() {
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const colors = useThemeColors();
  const stylesMemo = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {showAlert} = useAlert();
  const {notes, loading, refresh, addNote, removeNote, togglePin} = useNotes();
  const [actionMenu, setActionMenu] = useState<{
    note: Note;
    x: number;
    y: number;
  } | null>(null);
  const fabScale = useRef(new Animated.Value(1)).current;
  const popupWidth = 188;
  const popupHeight = 110;

  const popupLeft = useMemo(() => {
    if (!actionMenu) {
      return 0;
    }
    const desiredLeft = actionMenu.x - popupWidth / 2;
    return Math.max(12, Math.min(desiredLeft, screenWidth - popupWidth - 12));
  }, [actionMenu, screenWidth]);

  const popupTop = useMemo(() => {
    if (!actionMenu) {
      return 0;
    }
    const openBelow = actionMenu.y + popupHeight + 16 <= screenHeight;
    const desiredTop = openBelow
      ? actionMenu.y + 8
      : actionMenu.y - popupHeight - 8;
    return Math.max(78, Math.min(desiredTop, screenHeight - popupHeight - 24));
  }, [actionMenu, screenHeight]);

  async function handleCreateNote() {
    const created = await addNote({
      heading: '',
      contentRich: '<div style="font-size:20px"></div>',
      contentPlain: '',
      isPinned: false,
      pinnedAt: null,
    });
    if (!created) {
      return;
    }
    navigation.navigate('NoteEditor', {noteId: created.id});
  }

  function requestDelete(note: Note) {
    setActionMenu(null);
    showAlert('Delete note?', 'This action cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          LayoutAnimation.configureNext(LIST_ANIMATION);
          await removeNote(note.id);
        },
      },
    ]);
  }

  function handleTogglePin(note: Note) {
    setActionMenu(null);
    LayoutAnimation.configureNext(LIST_ANIMATION);
    void togglePin(note.id);
  }

  return (
    <SafeAreaView style={stylesMemo.container} edges={['top']}>
      <FlatList
        data={notes}
        numColumns={2}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={() => void refresh()}
        contentContainerStyle={stylesMemo.listContent}
        columnWrapperStyle={stylesMemo.rowGap}
        showsVerticalScrollIndicator={false}
        renderItem={({item}) => (
          <NoteCard
            note={item}
            selected={actionMenu?.note.id === item.id}
            onPress={() => navigation.navigate('NoteEditor', {noteId: item.id})}
            onLongPress={event =>
              setActionMenu({
                note: item,
                x: event.nativeEvent.pageX,
                y: event.nativeEvent.pageY,
              })
            }
            colors={colors}
          />
        )}
        ListHeaderComponent={
          <View style={stylesMemo.headerWrap}>
            <Text style={stylesMemo.headerTitle}>Note Down</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={stylesMemo.emptyWrap}>
            <Text style={stylesMemo.emptyTitle}>No notes yet</Text>
            <Text style={stylesMemo.emptyHint}>
              Hit the plus button to start
            </Text>
          </View>
        }
      />

      <BottomGradient colors={colors} />

      <Animated.View
        style={[stylesMemo.fabContainer, {transform: [{scale: fabScale}]}]}>
        <Pressable
          style={stylesMemo.fab}
          onPress={() => void handleCreateNote()}
          onPressIn={() =>
            Animated.spring(fabScale, {
              toValue: 0.92,
              speed: 40,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(fabScale, {
              toValue: 1,
              speed: 20,
              bounciness: 10,
              useNativeDriver: true,
            }).start()
          }>
          <AppIcon name="plus" size={32} color="#fff" />
        </Pressable>
      </Animated.View>

      {actionMenu ? (
        <View pointerEvents="box-none" style={stylesMemo.popupLayer}>
          <Pressable
            style={stylesMemo.popupBackdrop}
            onPress={() => setActionMenu(null)}
          />

          <View
            style={[stylesMemo.popupCard, {left: popupLeft, top: popupTop}]}>
            <Pressable
              style={stylesMemo.actionButton}
              onPress={() => handleTogglePin(actionMenu.note)}>
              <AppIcon name="pin" size={16} color={colors.text} />
              <Text style={stylesMemo.actionButtonText}>
                {actionMenu.note.isPinned ? 'Unpin' : 'Pin'}
              </Text>
            </Pressable>

            <Pressable
              style={[stylesMemo.actionButton, stylesMemo.actionButtonDanger]}
              onPress={() => requestDelete(actionMenu.note)}>
              <AppIcon name="trash-2" size={16} color={colors.danger} />
              <Text
                style={[stylesMemo.actionButtonText, {color: colors.danger}]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    flex: 1,
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 126,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeading: {
    fontSize: 21,
    fontFamily: fonts.headingSemiBold,
    letterSpacing: -0.3,
    flex: 1,
  },
  cardPreview: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.bodyMedium,
  },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerWrap: {
      paddingTop: 24,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 40,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -0.8,
      textAlign: 'center',
    },
    listContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 140,
    },
    rowGap: {
      gap: 16,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 72,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 24,
      color: colors.text,
      fontFamily: fonts.heading,
      letterSpacing: -0.4,
    },
    emptyHint: {
      fontSize: 14,
      color: colors.mutedText,
      fontFamily: fonts.bodyMedium,
    },
    fabContainer: {
      position: 'absolute',
      right: 48,
      bottom: 100,
      zIndex: 30,
    },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButton: {
      minHeight: 48,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceLight,
    },
    actionButtonDanger: {
      marginTop: 6,
    },
    actionButtonText: {
      fontSize: 14,
      color: colors.text,
      fontFamily: fonts.bodyBold,
    },
    popupLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
    },
    popupBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    popupCard: {
      position: 'absolute',
      width: 188,
      borderRadius: 14,
      padding: 8,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowOffset: {width: 0, height: 6},
      shadowRadius: 14,
      elevation: 10,
    },
  });
