'use client';

import React from 'react';
import {GuestOnly} from '@/components/auth/RouteGuards';
import {AuthScreen} from '@/screens/AuthScreen';

export default function LoginPage() {
  return (
    <GuestOnly>
      <AuthScreen mode="login" />
    </GuestOnly>
  );
}

