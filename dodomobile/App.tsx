import React, {useMemo} from 'react';
import {StatusBar} from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/navigation/RootNavigator';
import {AuthProvider} from './src/state/AuthContext';
import {TasksProvider} from './src/state/TasksContext';
import {CategoriesProvider} from './src/state/CategoriesContext';
import {HabitsProvider} from './src/state/HabitsContext';
import {NotesProvider} from './src/state/NotesContext';
import {
  PreferencesProvider,
  usePreferences,
} from './src/state/PreferencesContext';
import {
  ThemeColorsProvider,
  useThemeColors,
  useThemeMode,
} from './src/theme/ThemeProvider';
import {AlertProvider} from './src/state/AlertContext';
import {SyncProvider} from './src/state/SyncContext';
import {NotificationsBootstrap} from './src/state/NotificationsBootstrap';
import {ReminderScheduleBootstrap} from './src/state/ReminderScheduleBootstrap';
import {
  flushPendingNotificationNavigation,
  navigationRef,
} from './src/navigation/navigationRef';

function AppNavigation() {
  const colors = useThemeColors();
  const mode = useThemeMode();

  const navTheme = useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        text: colors.text,
        primary: colors.accent,
        card: colors.surface,
        border: colors.border,
      },
    };
  }, [colors, mode]);

  return (
    <>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <AuthProvider>
        <NotificationsBootstrap />
        <CategoriesProvider>
          <HabitsProvider>
            <NotesProvider>
              <TasksProvider>
                <SyncProvider>
                  <ReminderScheduleBootstrap />
                  <NavigationContainer
                    ref={navigationRef}
                    theme={navTheme}
                    onReady={flushPendingNotificationNavigation}>
                    <RootNavigator />
                  </NavigationContainer>
                </SyncProvider>
              </TasksProvider>
            </NotesProvider>
          </HabitsProvider>
        </CategoriesProvider>
      </AuthProvider>
    </>
  );
}

function AppShell() {
  const {preferences} = usePreferences();
  const mode = preferences.darkMode ? 'dark' : 'light';

  return (
    <ThemeColorsProvider mode={mode}>
      <AlertProvider>
        <AppNavigation />
      </AlertProvider>
    </ThemeColorsProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AppShell />
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
