import {NativeModules, Platform} from 'react-native';

type FocusModeAudioModule = {
  enableFocusModeSilence: () => Promise<boolean>;
  disableFocusModeSilence: () => Promise<boolean>;
  openPolicyAccessSettings: () => Promise<boolean>;
};

type FocusModeSilenceResult = 'enabled' | 'permission_required' | 'unavailable';

const nativeModule = NativeModules.FocusModeAudio as
  | FocusModeAudioModule
  | undefined;

export async function enableFocusModeSilence(): Promise<FocusModeSilenceResult> {
  if (Platform.OS !== 'android' || !nativeModule) {
    return 'unavailable';
  }

  try {
    await nativeModule.enableFocusModeSilence();
    return 'enabled';
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'permission_required'
    ) {
      return 'permission_required';
    }

    return 'unavailable';
  }
}

export async function openFocusModeSilenceSettings(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeModule) {
    return;
  }

  try {
    await nativeModule.openPolicyAccessSettings();
  } catch {
    // Ignore navigation failures and leave the user in the current flow.
  }
}

export async function disableFocusModeSilence(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeModule) {
    return;
  }

  try {
    await nativeModule.disableFocusModeSilence();
  } catch {
    // Ignore cleanup failures and leave the user in the current flow.
  }
}
