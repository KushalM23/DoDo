/**
 * @format
 */

import 'react-native';
import React from 'react';
import {it, jest} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('../src/navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: any) => children,
  DefaultTheme: {colors: {}},
  DarkTheme: {colors: {}},
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: any) => children,
}));

jest.mock('../src/state/AuthContext', () => ({
  AuthProvider: ({children}: any) => children,
}));

jest.mock('../src/state/TasksContext', () => ({
  TasksProvider: ({children}: any) => children,
}));

jest.mock('../src/state/CategoriesContext', () => ({
  CategoriesProvider: ({children}: any) => children,
}));

jest.mock('../src/state/HabitsContext', () => ({
  HabitsProvider: ({children}: any) => children,
}));

import App from '../App';

it('renders correctly', () => {
  renderer.create(<App />);
});
