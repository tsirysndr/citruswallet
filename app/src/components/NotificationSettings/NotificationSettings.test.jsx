import React from 'react';
import { Linking } from 'react-native';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { NotificationSettings } from './index';
import { enablePush, disablePush, pushStatus } from '../../notifications';
jest.mock('../../hooks', () => ({ useSession: () => ({ data: { did: 'did:plc:me' } }) }));
jest.mock('../../notifications', () => ({ enablePush: jest.fn(), disablePush: jest.fn(), pushStatus: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  pushStatus.mockResolvedValue({ enabled: false, registered: false, blocked: false });
  enablePush.mockResolvedValue(); disablePush.mockResolvedValue();
});
test('requests push only after tapping the toggle and reflects successful registration', async () => {
  renderComponent(<NotificationSettings />);
  const toggle = await screen.findByRole('switch', { name: 'Push notifications' });
  expect(enablePush).not.toHaveBeenCalled();
  pushStatus.mockResolvedValue({ enabled: true, registered: true, blocked: false });
  await fireEvent.press(toggle);
  await waitFor(() => expect(screen.getByText('Enabled on this device')).toBeTruthy());
  expect(enablePush).toHaveBeenCalledTimes(1);
  pushStatus.mockResolvedValue({ enabled: false, registered: false, blocked: false });
  await fireEvent.press(toggle);
  expect(disablePush).toHaveBeenCalledTimes(1);
  await screen.findByText('Off on this device');
});
test('links to system settings when permission is blocked', async () => {
  pushStatus.mockResolvedValue({ enabled: false, registered: false, blocked: true });
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  renderComponent(<NotificationSettings />);
  await fireEvent.press(await screen.findByText('Open device settings'));
  expect(open).toHaveBeenCalledTimes(1);
  open.mockRestore();
});
test('keeps the switch off and explains registration failures', async () => {
  enablePush.mockRejectedValue(new Error('Could not register this device.'));
  renderComponent(<NotificationSettings />);
  await fireEvent.press(await screen.findByRole('switch', { name: 'Push notifications' }));
  expect(await screen.findByText('Could not register this device.')).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Push notifications' }).props.accessibilityState.checked).toBe(false);
});
