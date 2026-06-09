type HapticType = "light" | "medium" | "heavy" | "soft" | "rigid";

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function hapticImpact(type: HapticType = "light") {
  const duration =
    type === "heavy" ? 45 : type === "medium" ? 32 : type === "rigid" ? 24 : 16;
  vibrate(duration);
}

export function hapticSuccess() {
  vibrate([40, 50, 40]);
}
