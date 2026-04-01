export async function enableFocusModeSilence(): Promise<
  'enabled' | 'permission_required' | 'unavailable'
> {
  return 'unavailable';
}

export async function openFocusModeSilenceSettings(): Promise<void> {
  return;
}

export async function disableFocusModeSilence(): Promise<void> {
  return;
}
