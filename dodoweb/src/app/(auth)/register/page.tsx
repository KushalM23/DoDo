'use client';

import {GuestOnly} from '@/components/auth/RouteGuards';
import {AuthScreen} from '@/screens/AuthScreen';

export default function RegisterPage() {
  return (
    <GuestOnly>
      <AuthScreen mode="register" />
    </GuestOnly>
  );
}

