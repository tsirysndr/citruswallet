import React from 'react';
import { screen, fireEventAsync as fireEvent, act } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { busyAtom } from '../../state';
import { Button } from './Button';
test('renders the complete sign-out label and blocks repeat actions while busy', async () => {
  const action = jest.fn();
  const { store } = renderComponent(<Button title="Sign out" onPress={action} />);
  expect(screen.getByText('Sign out')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => store.set(busyAtom, true));
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(action).toHaveBeenCalledTimes(1);
});
