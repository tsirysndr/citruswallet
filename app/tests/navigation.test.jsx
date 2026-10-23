import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'jotai';
import { BottomTabs } from '../src/components/BottomTabs';
import { Button } from '../src/components/ui';
test('floating navigation exposes all four destinations and the active tab', () => {
  const change = jest.fn();
  render(<BottomTabs screen="Payments" onChange={change} />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.getByRole('tab', { name: 'Payments' })).toBeSelected();
  fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
  expect(change).toHaveBeenCalledWith('Activity');
});
test('sign out renders its complete label and remains actionable', () => {
  const action = jest.fn();
  render(<Provider><Button title="Sign out" tone="plain" onPress={action} /></Provider>);
  expect(screen.getByText('Sign out')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(action).toHaveBeenCalledTimes(1);
});
