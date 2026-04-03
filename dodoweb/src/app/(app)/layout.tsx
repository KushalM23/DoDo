'use client';

import React from 'react';
import {RequireAppReady, RequireAuth} from '@/components/auth/RouteGuards';
import {DesktopShell} from '@/components/layout/DesktopShell';

export default function AuthenticatedLayout({children}: {children: React.ReactNode}) {
  return (
    <RequireAuth>
      <RequireAppReady>
        <DesktopShell>{children}</DesktopShell>
      </RequireAppReady>
    </RequireAuth>
  );
}

