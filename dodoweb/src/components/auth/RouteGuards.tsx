"use client";

import React, { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthContext";
import { useCategories } from "@/providers/CategoriesContext";
import { useHabits } from "@/providers/HabitsContext";
import { useNotes } from "@/providers/NotesContext";
import { useTasks } from "@/providers/TasksContext";
import { sanitizeRedirectPath } from "@/utils/navigation";

function RequireAuthContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const query = searchParams.toString();
      const targetPath = pathname && pathname !== "/" ? pathname : "/tasks";
      const currentPath = `${targetPath}${query ? `?${query}` : ""}`;
      const from = sanitizeRedirectPath(currentPath, "/tasks");
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    }
  }, [loading, pathname, router, searchParams, user]);

  if (loading || !user) {
    return <LoadingScreen variant="app" title="DODO" />;
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen variant="app" title="DODO" />}>
      <RequireAuthContent>{children}</RequireAuthContent>
    </Suspense>
  );
}

export function RequireAppReady({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { initialized: tasksInitialized } = useTasks();
  const { initialized: habitsInitialized } = useHabits();
  const { initialized: categoriesInitialized } = useCategories();
  const { initialized: notesInitialized } = useNotes();

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

function GuestOnlyContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = sanitizeRedirectPath(searchParams.get("from"), "/tasks");

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

export function GuestOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen variant="app" title="DODO" />}>
      <GuestOnlyContent>{children}</GuestOnlyContent>
    </Suspense>
  );
}
