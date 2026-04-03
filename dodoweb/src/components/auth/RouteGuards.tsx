'use client';

import React, {useEffect} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {useAuth} from '@/providers/AuthContext';
import {useCategories} from '@/providers/CategoriesContext';
import {useHabits} from '@/providers/HabitsContext';
import {useNotes} from '@/providers/NotesContext';
import {useTasks} from '@/providers/TasksContext';
import {sanitizeRedirectPath} from '@/utils/navigation';

export function RequireAuth({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const query = searchParams.toString();
      const currentPath = pathname
        ? `${pathname}${query ? `?${query}` : ''}`
        : '/tasks';
      const from = sanitizeRedirectPath(currentPath, '/tasks');
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    }
  }, [loading, pathname, router, searchParams, user]);

  if (loading || !user) {
    return <LoadingScreen variant="app" title="DODO" />;
  }

  return <>{children}</>;
}

export function RequireAppReady({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const {initialized: tasksInitialized} = useTasks();
  const {initialized: habitsInitialized} = useHabits();
  const {initialized: categoriesInitialized} = useCategories();
  const {initialized: notesInitialized} = useNotes();

  const appReady =
    !user ||
    (tasksInitialized &&
      habitsInitialized &&
      categoriesInitialized &&
      notesInitialized);

  if (!appReady) {
    return <LoadingScreen variant="app" title="DODO" />;
  }

  return <>{children}</>;
}

export function GuestOnly({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = sanitizeRedirectPath(searchParams.get('from'), '/tasks');

  useEffect(() => {
    if (!loading && user) {
      router.replace(from);
    }
  }, [from, loading, router, user]);

  if (loading || user) {
    return <LoadingScreen variant="app" title="DODO" />;
  }

  return <>{children}</>;
}

