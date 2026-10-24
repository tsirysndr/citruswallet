import React from 'react';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { renderComponent } from './render';
import { useNotifications } from '../src/notifications';
import { request } from '../src/api';

jest.mock('../src/network', () => ({ selectedChain: () => '6343', saveNetwork: jest.fn() }));
jest.mock('../src/api', () => ({ currentToken: () => null, origin: 'https://peachlet.app', request: jest.fn(async () => ({})) }));
jest.mock('react-native-sse', () => jest.fn());
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'test-project' } } } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

function Consumer() { useNotifications('did:plc:test'); return null; }
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.setItem('citrus-push-token', 'ExponentPushToken[test]');
});

test('Android token reads cannot recursively refresh push registration', async () => {
  const token = { type: 'android', data: 'device-token' };
  let reads = 0;
  Notifications.getExpoPushTokenAsync.mockImplementation(async options => {
    if (!options.devicePushToken) {
      reads++;
      // Match Android: reading a token emits the token-change event too.
      if (reads < 10) Notifications.addPushTokenListener.mock.calls[0][0](token);
    }
    return { data: 'ExponentPushToken[test]' };
  });
  const view = renderComponent(<Consumer />);
  await act(async () => {});
  expect(reads).toBe(1);
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenLastCalledWith({ projectId: 'test-project', devicePushToken: token });
  const listener = Notifications.addPushTokenListener.mock.calls[0][0];
  await act(async () => { listener(token); listener(token); });
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(2);
  await act(async () => { listener({ ...token, data: 'rotated-token' }); });
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(3);
  expect(request).toHaveBeenCalledWith('registerPushToken', { token: 'ExponentPushToken[test]', platform: expect.any(String) });
  view.unmount();
  await act(async () => { listener({ ...token, data: 'after-unmount' }); });
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(3);
});
