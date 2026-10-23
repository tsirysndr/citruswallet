import { expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { createStore } from 'jotai';
import { renderComponent, screen } from '../../test/render';
import { busyAtom } from '../../atoms';
import { requestApproval } from '../../wallet-approval';
import { WalletApproval } from './index';
it('allows explicit confirmation while the payment action is busy', async () => {
  const store = createStore(); store.set(busyAtom, true);
  const { user } = await renderComponent(<WalletApproval />, { store });
  let result!: Promise<boolean>;
  act(() => { result = requestApproval({ network: 'MegaETH', to: '0x123', value: '0.1', fee: '0.00001', nonce: 1, token: false }); });
  expect(screen.getByRole('button', { name: 'Send payment' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await expect(result).resolves.toBe(false);
});
