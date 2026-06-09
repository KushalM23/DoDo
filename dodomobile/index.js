import {AppRegistry, Platform, StyleSheet} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {EventType} from '@notifee/react-native';
import {registerWidgetTaskHandler} from 'react-native-android-widget';
import {widgetTaskHandler} from './src/widget/widgetTaskHandler';
import {QuickAddApp} from './src/screens/widget/QuickAddTaskScreen';
import {name as appName} from './app.json';
import {
  handleBackgroundNotificationEvent,
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

notifee.onBackgroundEvent(async event => {
  if (event.type === EventType.PRESS || event.type === EventType.ACTION_PRESS) {
    await handleBackgroundNotificationEvent(event);
  }
});

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('DodoWidgetQuickAdd', () => QuickAddApp);

registerWidgetTaskHandler(widgetTaskHandler);
