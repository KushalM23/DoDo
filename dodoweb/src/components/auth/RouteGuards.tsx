'use client';

import React, {useEffect} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {LoadingScreen} from '@/components/common/LoadingScreen';
import {useAuth} from '@/providers/AuthContext';

export function RequireAuth({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const from = pathname && pathname !== '/' ? pathname : '/tasks';
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return <LoadingScreen title="Loading DODO" />;
  }

  return <>{children}</>;
}

export function GuestOnly({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/tasks');
    }
  }, [loading, router, user]);

  if (loading || user) {
    return <LoadingScreen title="Loading DODO" />;
  }

  return <>{children}</>;
}
