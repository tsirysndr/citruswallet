import React from 'react';
import { render, fireEventAsync as fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { Payments } from '../src/screens/Payments';
import { HandleInput } from '../src/components/HandleInput';
import { request } from '../src/api';

const mockSession = { did: 'did:plc:me', network: { name: 'Ethereum', chainId: 1 }, paymentsEnabled: true };
jest.mock('../src/hooks', () => ({ useSession: () => ({ data: mockSession }), useAction: () => fn => fn() }));
jest.mock('../src/api', () => ({ request: jest.fn() }));
jest.mock('../src/wallet', () => ({ pending: jest.fn(async () => null), recover: jest.fn(), sendPayment: jest.fn() }));
jest.mock('../src/klipy', () => ({ recordShare: jest.fn(), klipyEnabled: false, mediaKinds: [], fetchMedia: jest.fn() }));
const alice = { did: 'did:plc:alice', handle: 'alice.bsky.social', displayName: 'Alice', avatar: 'https://example.com/alice.jpg' };
const payment = { id: 'payment1', senderDid: 'did:plc:me', recipientDid: alice.did, recipient: alice, recipientLabel: alice.handle, amount: '1', state: 'ready', address: '0x123', revision: 1 };
function mount(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<Provider><QueryClientProvider client={client}>{element}</QueryClientProvider></Provider>);
}
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async method => method === 'resolveRecipient' ? { did: alice.did, handle: alice.handle } : { payment });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ actors: [alice, { ...alice, did: mockSession.did, handle: 'me.bsky.social' }] }) }));
});
test('recipient, amount and review are successive screens; back keeps the amount', async () => {
  mount(<Payments />);
  expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  expect(screen.queryByLabelText('Amount 0 ETH')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), alice.handle);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy());
  expect(screen.queryByLabelText('Recipient handle')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
  await fireEvent.changeText(screen.getByLabelText('Description (optional)'), 'Lunch');
  await fireEvent.press(screen.getByRole('button', { name: 'Back to recipient' }));
  expect(screen.queryByLabelText('Description (optional)')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Amount 1 ETH')).toBeTruthy());
  expect(screen.getByLabelText('Description (optional)').props.value).toBe('Lunch');
  await fireEvent.press(screen.getByRole('button', { name: 'Review payment' }));
  await waitFor(() => expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy());
  expect(screen.queryByLabelText('Amount 1 ETH')).toBeNull();
  expect(screen.queryByLabelText('Description (optional)')).toBeNull();
  expect(request).toHaveBeenCalledWith('createPayment', expect.objectContaining({ identifier: alice.did, expectedDid: alice.did, amount: '1', description: 'Lunch' }));
  expect(screen.getByRole('button', { name: 'Approve in MetaMask' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit details' }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy());
  expect(request).toHaveBeenCalledWith('cancelPayment', { id: 'payment1' });
});
test('recipient suggestions display avatars and names and exclude the current user', async () => {
  const onSelect = jest.fn();
  mount(<HandleInput value="alice" onChange={() => {}} onSelect={onSelect} excludeDid={mockSession.did} label="Recipient handle" />);
  await fireEvent(screen.getByLabelText('Recipient handle'), 'focus');
  await waitFor(() => expect(screen.getByRole('button', { name: `Use @${alice.handle}` })).toBeTruthy());
  expect(screen.getByLabelText('Alice avatar')).toBeTruthy();
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Use @me.bsky.social' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: `Use @${alice.handle}` }));
  expect(onSelect).toHaveBeenCalledWith(alice);
});

test('starting a new payment resets the draft and returns to recipient selection', async () => {
  mount(<Payments />);
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), alice.handle);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Review payment' }));
  await waitFor(() => expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'New payment' }));
  expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  expect(screen.getByLabelText('Recipient handle').props.value).toBe('');
});
