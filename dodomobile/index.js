import {AppRegistry, Platform, StyleSheet} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {EventType} from '@notifee/react-native';
import {name as appName} from './app.json';
import {
  handleBackgroundNotificationPress,
  handleBackgroundRemoteMessage,
} from './src/services/notifications';

const poppins = {
  regular: 'Poppins-Regular',
};

const isObject = value =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const normalizeTypographyStyle = style => {
  if (!isObject(style)) {
    return style;
  }

  const next = {...style};

  if (!next.fontFamily) {
    next.fontFamily = poppins.regular;
  }

  return next;
};

if (Platform.OS === 'android') {
  const originalFlatten = StyleSheet.flatten.bind(StyleSheet);

  StyleSheet.flatten = style =>
    normalizeTypographyStyle(originalFlatten(style));
}

const App = require('./App').default;

messaging().setBackgroundMessageHandler(async remoteMessage => {
  await handleBackgroundRemoteMessage(remoteMessage);
});

notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    handleBackgroundNotificationPress(detail.notification?.data);
  }
});

AppRegistry.registerComponent(appName, () => App);
