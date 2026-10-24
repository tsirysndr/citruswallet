import { it, expect } from 'vitest';
import { renderComponent, screen } from '../../test/render';
import { NetworkSettings } from './index';
it('validates custom RPC syntax before contacting the endpoint', async () => {
  const { user } = await renderComponent(<NetworkSettings />);
  await user.click(screen.getByText('Advanced: custom RPC'));
  await user.type(screen.getByLabelText('HTTPS RPC URL (optional)'), 'http://rpc.example.com');
  await user.click(screen.getByRole('button', { name: 'Save network' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('HTTPS');
  expect(localStorage.getItem('citrus:chain')).toBeNull();
});

it('offers MegaETH testnet and explains that its funds are for testing', async () => {
  const { user } = await renderComponent(<NetworkSettings />);
  await user.selectOptions(screen.getByLabelText('Use network'), '6343');
  expect(screen.getByLabelText('Use network')).toHaveValue('6343');
  expect(screen.getByText('For testing only. Testnet ETH has no real value.')).toBeInTheDocument();
});
