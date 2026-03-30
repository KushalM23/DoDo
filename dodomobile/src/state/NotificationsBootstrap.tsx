import {useEffect, useRef} from 'react';
import {Platform} from 'react-native';
import {type PushPlatform, upsertPushToken} from '../services/api';
import {
  getCurrentFcmToken,
  registerNotificationHandlers,
} from '../services/notifications';
import {useAuth} from './AuthContext';

function getPushPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function devWarn(message: string, error: unknown): void {
  if (__DEV__) {
    console.warn('[NotificationsBootstrap]', message, error);
  }
}

export function NotificationsBootstrap() {
  const {token, user} = useAuth();
  const authStateRef = useRef<{token: string | null; userId: string | null}>({
    token: null,
    userId: null,
  });
  const previousTokenRef = useRef<string | null>(null);

  useEffect(() => {
    authStateRef.current = {
      token,
      userId: user?.id ?? null,
    };
  }, [token, user?.id]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const syncToken = async (fcmToken: string) => {
      if (!active) {
        return;
      }

      const authState = authStateRef.current;
      if (!authState.token || !authState.userId) {
        return;
      }

      try {
        await upsertPushToken({
          token: fcmToken,
          platform: getPushPlatform(),
        });
      } catch (error) {
        devWarn('Unable to sync push token with backend', error);
      }
    };

    void registerNotificationHandlers({onToken: syncToken})
      .then(unsub => {
        unsubscribe = unsub;
      })
      .catch(error => {
        devWarn('Unable to initialize notification handlers', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!token || !user?.id) {
      return;
    }

    void (async () => {
      try {
        const fcmToken = await getCurrentFcmToken();
        if (!active || !fcmToken || previousTokenRef.current === fcmToken) {
          return;
        }

        await upsertPushToken({
          token: fcmToken,
          platform: getPushPlatform(),
        });

        previousTokenRef.current = fcmToken;
      } catch (error) {
        devWarn('Unable to sync existing push token after auth change', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, user?.id]);

  return null;
}
