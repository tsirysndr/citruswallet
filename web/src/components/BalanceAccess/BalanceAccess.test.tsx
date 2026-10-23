import { it, expect, vi } from 'vitest';
import { renderComponent, screen } from '../../test/render';
import { session } from '../../test/mocks/fixtures';
import { BalanceAccess } from './index';
import { WalletUnlock } from '../WalletUnlock';
import { noBalances } from '../../wallet';
it('opens the password/device unlock dialog directly from the balance card', async () => {
  localStorage.setItem('citrus:encrypted-wallet:v1', '{}');
  const refresh = vi.fn(async () => {});
  const { user } = await renderComponent(<><BalanceAccess session={session} available={false} loading={false} refresh={refresh} /><WalletUnlock /></>);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Unlock wallet' }));
  expect(screen.getByRole('dialog', { name: 'Unlock Citrus wallet' })).toBeVisible();
  expect(screen.getByLabelText('Wallet password')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(refresh).not.toHaveBeenCalled();
});
it('offers MetaMask connection when an external wallet is disconnected', async () => {
  await renderComponent(<BalanceAccess session={session} balances={noBalances} available={false} loading={false} refresh={async () => {}} />);
  expect(screen.getByRole('button', { name: 'Connect MetaMask' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Unlock wallet' })).not.toBeInTheDocument();
});
it('retries a failed balance read directly', async () => {
  const refresh = vi.fn(async () => {});
  const { user } = await renderComponent(<BalanceAccess session={session} balances={{ ...noBalances, unavailable: true }} available={false} loading={false} refresh={refresh} />);
  await user.click(screen.getByRole('button', { name: 'Refresh balance' }));
  expect(refresh).toHaveBeenCalledOnce();
});
