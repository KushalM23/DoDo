const SOUND_FILES = {
  task: '/sounds/task-complete.mp3',
  focusEnter: '/sounds/focus-enter.mp3',
  focusExit: '/sounds/focus-exit.mp3',
};

async function play(url: string) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.7;
    await audio.play();
  } catch {
    // Ignore playback failures; desktop browsers often block autoplay.
  }
}

export function playTaskCompleteSound() {
  void play(SOUND_FILES.task);
}

export function playFocusEnterSound() {
  void play(SOUND_FILES.focusEnter);
}

export function playFocusExitSound() {
  void play(SOUND_FILES.focusExit);
}
