import React from 'react';
import { render, screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { WalletAction } from './WalletAction';
test.each([['link', 'Link wallet'], ['send', 'Send']])('%s displays its action and invokes it', async (action, label) => {
  const press = jest.fn(); render(<WalletAction action={action} onPress={press} />);
  await fireEvent.press(screen.getByRole('button', { name: label }));
  expect(press).toHaveBeenCalledTimes(1);
});
