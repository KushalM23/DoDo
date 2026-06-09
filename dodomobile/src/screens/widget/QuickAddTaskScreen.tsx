import React from 'react';
import { View, BackHandler, StyleSheet, Pressable } from 'react-native';
import { useAuth, AuthProvider } from '../../state/AuthContext';
import { useCategories, CategoriesProvider } from '../../state/CategoriesContext';
import { createTaskLocal } from '../../lib/local/repository';
import { requestDodoWeekWidgetUpdate, requestDodoMonthWidgetUpdate } from '../../widget/widgetUpdater';
import { TaskForm } from '../../components/forms/TaskForm';
import { toLocalDateKey } from '../../utils/dateTime';
import { PreferencesProvider, usePreferences } from '../../state/PreferencesContext';
import { AlertProvider } from '../../state/AlertContext';
import { ThemeColorsProvider } from '../../theme/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function QuickAddTaskScreen() {
  const { user } = useAuth();
  const { categories } = useCategories();

  const handleSubmit = async (input: any) => {
    if (!user?.id) {
      BackHandler.exitApp();
      return;
    }
    try {
      await createTaskLocal(user.id, input);
      requestDodoWeekWidgetUpdate();
      requestDodoMonthWidgetUpdate();
    } catch (err) {
      console.error('[QuickAddTaskScreen] Error creating task:', err);
    } finally {
      BackHandler.exitApp();
    }
  };

  const handleCancel = () => {
    BackHandler.exitApp();
  };

  const todayStr = toLocalDateKey(new Date());

  return (
    <View style={styles.container}>
      <Pressable style={styles.backdrop} onPress={handleCancel} />
      <TaskForm
        visible={true}
        categories={categories}
        defaultDate={todayStr}
        defaultCategoryId={null}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </View>
  );
}

function QuickAddAppContent() {
  return <QuickAddTaskScreen />;
}

function QuickAddAppWrapper() {
  const { preferences } = usePreferences();
  const mode = preferences.darkMode ? 'dark' : 'light';

  return (
    <ThemeColorsProvider mode={mode}>
      <AlertProvider>
        <CategoriesProvider>
          <QuickAddAppContent />
        </CategoriesProvider>
      </AlertProvider>
    </ThemeColorsProvider>
  );
}

export function QuickAddApp() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <QuickAddAppWrapper />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
