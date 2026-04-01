'use client';

import React from 'react';
import {RequireAuth} from '@/components/auth/RouteGuards';
import {DesktopShell} from '@/components/layout/DesktopShell';

export default function AuthenticatedLayout({children}: {children: React.ReactNode}) {
  return (
    <RequireAuth>
      <DesktopShell>{children}</DesktopShell>
    </RequireAuth>
  );
}

