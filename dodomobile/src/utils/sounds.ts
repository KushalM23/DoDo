import TrackPlayer, {
  IOSCategory,
  IOSCategoryOptions,
} from 'react-native-track-player';

let isPlayerSetup = false;

export const setupPlayer = async () => {
  if (isPlayerSetup) {
    return;
  }
  try {
    await TrackPlayer.setupPlayer({
      iosCategory: IOSCategory.Playback,
      iosCategoryOptions: [
        IOSCategoryOptions.MixWithOthers,
        IOSCategoryOptions.DuckOthers,
      ],
    });
    isPlayerSetup = true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already')) {
      isPlayerSetup = true;
      return;
    }
    console.error('Failed to setup track player:', error);
  }
};

export const playSound = async (soundUrl: string | number) => {
  try {
    if (!isPlayerSetup) {
      await setupPlayer();
    }

    const soundId = soundUrl.toString();
    const queue = await TrackPlayer.getQueue();

    if (queue.length > 0 && queue[0].id === soundId) {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      return;
    }

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: soundId,
      url: soundUrl as any,
      title: 'Sound Effect',
      artist: 'DoDo',
    });
    await TrackPlayer.play();
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
};

export const playTaskCompleteSound = () => {
  playSound(require('../../assets/task-complete.mp3'));
};

export const playFocusEnterSound = () => {
  playSound(require('../../assets/focus-enter.mp3'));
};

export const playFocusExitSound = () => {
  playSound(require('../../assets/focus-exit.mp3'));
};
