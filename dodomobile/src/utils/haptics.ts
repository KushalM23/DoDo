import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const hapticImpact = (type: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light') => {
  try {
    const feedbackType = type === 'light' ? 'impactLight' :
                         type === 'medium' ? 'impactMedium' :
                         type === 'heavy' ? 'impactHeavy' :
                         type === 'soft' ? 'impactSoft' : 'impactRigid';
    ReactNativeHapticFeedback.trigger(feedbackType, options);
  } catch (e) {
    console.error('Haptic error', e);
  }
};

export const hapticSuccess = () => {
  try {
    ReactNativeHapticFeedback.trigger('notificationSuccess', options);
  } catch (e) {
    console.error('Haptic error', e);
  }
};

export const hapticError = () => {
  try {
    ReactNativeHapticFeedback.trigger('notificationError', options);
  } catch (e) {
    console.error('Haptic error', e);
  }
};
