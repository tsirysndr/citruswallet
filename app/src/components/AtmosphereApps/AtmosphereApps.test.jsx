import React from 'react';
import { AccessibilityInfo, Linking } from 'react-native';
import { screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { AtmosphereApps } from './AtmosphereApps';
afterEach(() => jest.restoreAllMocks());
test('shows app logos, opens the explainer and lets the user pause scrolling', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  renderComponent(<AtmosphereApps />);
  expect(screen.getByRole('image', { name: /Apps in the Atmosphere: Bluesky/ })).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Pause app animation' }));
  expect(screen.getByRole('button', { name: 'Play app animation' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'What is an atmosphere account?' }));
  expect(open).toHaveBeenCalledWith('https://atmosphereaccount.com');
});
test('keeps logos still when reduced motion is enabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  renderComponent(<AtmosphereApps />);
  expect(await screen.findByRole('image', { name: /Apps in the Atmosphere/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Pause app animation' })).toBeNull();
});
