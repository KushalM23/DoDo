/**
 * HabitScreen — Object-Based Layout
 *
 * Hero: Simple Labels
 * Action: Floating CTA
 * Sheet: Habits revealed as slab objects in grid
 */
import React, {useMemo, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useHabits} from '../../state/HabitsContext';
import {HabitForm} from '../../components/forms/HabitForm';
import {BottomGradient} from '../../components/display/BottomGradient';
import {AppIcon} from '../../components/AppIcon';
import {LoadingScreen} from '../../components/feedback/LoadingScreen';
import type {Habit} from '../../types/habit';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {type ThemeColors, useThemeColors} from '../../theme/ThemeProvider';
import {fonts} from '../../theme/fonts';

/* ─── Habit Grid Item ─────────────────────────────────────────── */
function HabitGridItem({habit, onPress}: {habit: Habit; onPress: () => void}) {
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: false,
      speed: 40,
    }).start();
  }
  function onPressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
  }

  let frequencyLabel = 'daily';
  if (habit.frequencyType === 'interval') {
    frequencyLabel = `every ${habit.intervalDays} days`;
  } else if (habit.frequencyType === 'custom_days') {
    frequencyLabel = `${habit.customDays.length}x / week`;
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{scale: scaleAnim}],
        borderRadius: 16,
        backgroundColor: colors.surface,
        marginBottom: 16,
        height: 130,
        shadowColor: colors.shadow,
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
        opacity: habit.isPaused ? 0.8 : 1,
        borderWidth: habit.isPaused ? 1 : 0,
        borderColor: colors.surfaceLight,
      }}>
      <Pressable
        style={{
          flex: 1,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}>
        <AppIcon name={habit.icon} size={32} color={colors.habitBadge} />

        <View style={{alignItems: 'center', paddingHorizontal: 4}}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: fonts.bodyBold,
              color: colors.text,
              letterSpacing: -0.2,
              textAlign: 'center',
            }}
            numberOfLines={2}>
            {habit.title}
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, justifyContent: 'center'}}>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedText,
                fontFamily: fonts.bodySemiBold,
                textAlign: 'center',
              }}>
              {frequencyLabel}
            </Text>
            {habit.isPaused && (
              <View
                style={{
                  backgroundColor: colors.surfaceLight,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 4,
                }}>
                <Text
                  style={{
                    fontSize: 9,
                    color: colors.mutedText,
                    fontFamily: fonts.bodyBold,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                  Paused
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ─── Main Screen ─────────────────────────────────────────── */
export function HabitScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {habits, addHabit, initialized} = useHabits();
  const [formVisible, setFormVisible] = useState(false);
  const plusBtnScale = useRef(new Animated.Value(1)).current;

  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => a.title.localeCompare(b.title));
  }, [habits]);

  if (!initialized) {
    return <LoadingScreen title="Loading habits" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={sortedHabits}
        numColumns={2}
        keyExtractor={h => h.id}
        contentContainerStyle={styles.listPad}
        columnWrapperStyle={styles.rowGap}
        showsVerticalScrollIndicator={false}
        renderItem={({item}) => (
          <HabitGridItem
            habit={item}
            onPress={() =>
              navigation.navigate('HabitDetail', {habitId: item.id})
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.headerTitle}>Your Habits</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No habits active</Text>
            <Text style={styles.emptyHint}>Hit the plus button to start</Text>
          </View>
        }
      />

      {/* Bottom Gradient overlay */}
      <BottomGradient colors={colors} />

      {/* Floating Add Action */}
      <Animated.View
        style={[styles.fabContainer, {transform: [{scale: plusBtnScale}]}]}>
        <Pressable
          style={styles.fab}
          onPress={() => setFormVisible(true)}
          onPressIn={() =>
            Animated.spring(plusBtnScale, {
              toValue: 0.9,
              useNativeDriver: true,
              speed: 40,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(plusBtnScale, {
              toValue: 1,
              useNativeDriver: true,
              speed: 20,
              bounciness: 10,
            }).start()
          }>
          <AppIcon name="plus" size={32} color="#ffffff" />
        </Pressable>
      </Animated.View>

      <HabitForm
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onSubmit={addHabit}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 24,
    },
    listPad: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 120,
    },
    headerWrap: {
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 40,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -0.8,
      textAlign: 'center',
    },
    rowGap: {
      gap: 16,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 80,
      gap: 8,
    },
    emptyText: {
      fontSize: 24,
      fontFamily: fonts.heading,
      color: colors.text,
      letterSpacing: -0.5,
    },
    emptyHint: {
      fontSize: 16,
      color: colors.mutedText,
      fontFamily: fonts.bodySemiBold,
    },
    fabContainer: {
      position: 'absolute',
      bottom: 100,
      right: 48,
      zIndex: 20,
    },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
