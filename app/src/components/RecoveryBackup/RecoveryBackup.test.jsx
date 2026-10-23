import React from 'react';
import { render, screen, within, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { RecoveryBackup } from './index';
jest.mock('@citruswallet/wallet-core', () => ({ recoveryChallenge: () => [
  { index: 1, choices: ['wrong', 'abandon', 'other', 'choice'] },
  { index: 5, choices: ['wrong', 'other', 'abandon', 'choice'] },
  { index: 11, choices: ['about', 'wrong', 'other', 'choice'] },
] }));
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('prefills nine words, offers tap choices for three, and resets confirmation when reviewing', async () => {
  const confirmed = jest.fn();
  render(<RecoveryBackup phrase={phrase} onConfirmed={confirmed} />);
  await fireEvent.press(screen.getByRole('button', { name: 'I’ve saved my recovery phrase' }));
  expect(screen.getAllByRole('button', { name: /^Choose word/ })).toHaveLength(3);
  expect(screen.getAllByText('abandon')).toHaveLength(10); // Nine prefilled plus one choice.
  await fireEvent.press(screen.getByRole('button', { name: 'wrong' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(confirmed).not.toHaveBeenCalledWith(true);
  for (const word of ['abandon', 'abandon', 'about']) await fireEvent.press(within(screen.getByTestId('recovery-word-choices')).getByRole('button', { name: word }));
  expect(confirmed).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('Backup confirmed. You’re ready to save your wallet.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Review my recovery phrase' }));
  expect(confirmed).toHaveBeenLastCalledWith(false);
  expect(screen.queryAllByRole('button', { name: /^Choose word/ })).toHaveLength(0);
});
