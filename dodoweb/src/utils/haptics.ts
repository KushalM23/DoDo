type HapticType = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

function vibrate(duration: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

export function hapticImpact(type: HapticType = 'light') {
  const duration =
    type === 'heavy' ? 24 : type === 'medium' ? 18 : type === 'rigid' ? 14 : 10;
  vibrate(duration);
}

export function hapticSuccess() {
  vibrate(28);
}
