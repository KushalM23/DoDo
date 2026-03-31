import TrackPlayer from 'react-native-track-player';

let isPlayerSetup = false;

export const setupPlayer = async () => {
  if (isPlayerSetup) return;
  try {
    await TrackPlayer.setupPlayer();
    isPlayerSetup = true;
  } catch (error) {
    console.error('Failed to setup track player:', error);
  }
};

export const playSound = async (soundUrl: string) => {
  try {
    if (!isPlayerSetup) {
      await setupPlayer();
    }
    
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: 'sound_effect',
      url: soundUrl,
      title: 'Sound Effect',
      artist: 'DoDo',
    });
    
    await TrackPlayer.play();
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
};

export const playTaskCompleteSound = () => {
  playSound(require('../../assets/task_complete.mp3'));
};

export const playFocusEnterSound = () => {
  playSound(require('../../assets/focus_enter.mp3'));
};

export const playFocusExitSound = () => {
  playSound(require('../../assets/focus_exit.mp3'));
};
