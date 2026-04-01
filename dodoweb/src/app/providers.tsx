'use client';

import React from 'react';
import {AlertProvider} from '@/providers/AlertContext';
import {AuthProvider} from '@/providers/AuthContext';
import {CategoriesProvider} from '@/providers/CategoriesContext';
import {HabitsProvider} from '@/providers/HabitsContext';
import {NotesProvider} from '@/providers/NotesContext';
import {PreferencesProvider, usePreferences} from '@/providers/PreferencesContext';
import {SyncProvider} from '@/providers/SyncContext';
import {TasksProvider} from '@/providers/TasksContext';
import {ThemeColorsProvider} from '@/theme/ThemeProvider';

function ProvidersInner({children}: {children: React.ReactNode}) {
  const {preferences} = usePreferences();
  const mode = preferences.darkMode ? 'dark' : 'light';

  return (
    <ThemeColorsProvider mode={mode}>
      <AlertProvider>
        <AuthProvider>
          <CategoriesProvider>
            <HabitsProvider>
              <NotesProvider>
                <TasksProvider>
                  <SyncProvider>{children}</SyncProvider>
                </TasksProvider>
              </NotesProvider>
            </HabitsProvider>
          </CategoriesProvider>
        </AuthProvider>
      </AlertProvider>
    </ThemeColorsProvider>
  );
}

export function AppProviders({children}: {children: React.ReactNode}) {
  return (
    <PreferencesProvider>
      <ProvidersInner>{children}</ProvidersInner>
    </PreferencesProvider>
  );
}
