import React from 'react';
import { render, fireEventAsync as fireEvent, screen, waitFor, within, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackHandler } from 'react-native';
import { Provider } from 'jotai';
import { Payments } from '../src/screens/Payments';
import { HandleInput } from '../src/components/HandleInput';
import { request } from '../src/api';

const mockActionError = jest.fn();
const mockSession = { did: 'did:plc:me', network: { name: 'Ethereum', chainId: 1 }, paymentsEnabled: true };
jest.mock('../src/hooks', () => ({ useSession: () => ({ data: mockSession }), useAction: () => fn => fn().catch(mockActionError) }));
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
  mockActionError.mockReset();
  request.mockImplementation(async method => method === 'resolveRecipient' ? { did: alice.did, handle: alice.handle } : { payment });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ actors: [alice, { ...alice, did: mockSession.did, handle: 'me.bsky.social' }] }) }));
});
async function enterAmount() {
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), alice.handle);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
}
async function enterDescription() {
  await enterAmount();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('Step 3 of 4')).toBeTruthy();
}
async function reviewPayment() {
  await enterDescription();
  await fireEvent.press(screen.getByRole('button', { name: 'Review payment' }));
  await waitFor(() => expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy());
}
test('amount and description have separate screens and tapping earlier steps preserves the draft', async () => {
  mount(<Payments />);
  expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Go to description step' })).toBeDisabled();
  await enterAmount();
  expect(screen.queryByLabelText('Description (optional)')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add GIF, sticker, meme or clip' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByLabelText('Amount 1 ETH')).toBeNull();
  expect(within(screen.getByTestId('description-composer')).getByRole('button', { name: 'Add GIF, sticker, meme or clip' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Description (optional)'), 'Lunch');
  await fireEvent.press(screen.getByRole('button', { name: 'Go to amount step' }));
  expect(screen.getByLabelText('Amount 1 ETH')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to recipient' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('Description (optional)').props.value).toBe('Lunch');
  expect(request).not.toHaveBeenCalledWith('createPayment', expect.anything());
  await fireEvent.press(screen.getByRole('button', { name: 'Review payment' }));
  await waitFor(() => expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy());
  expect(screen.queryByLabelText('Description (optional)')).toBeNull();
  expect(request).toHaveBeenCalledWith('createPayment', expect.objectContaining({ identifier: alice.did, amount: '1', description: 'Lunch' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Go to description step' }));
  await waitFor(() => expect(screen.getByLabelText('Step 3 of 4')).toBeTruthy());
  expect(request).toHaveBeenCalledWith('cancelPayment', { id: 'payment1' });
  expect(screen.getByLabelText('Description (optional)').props.value).toBe('Lunch');
});
test('Android back returns from description to amount', async () => {
  let back;
  const subscription = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    back = listener; return { remove: jest.fn() };
  });
  try {
    mount(<Payments />);
    await enterDescription();
    await act(async () => { expect(back()).toBe(true); });
    expect(screen.getByLabelText('Amount 1 ETH')).toBeTruthy();
  } finally { subscription.mockRestore(); }
});
test('failed cancellation keeps review intact and prepared payments cannot be edited', async () => {
  mount(<Payments />);
  await reviewPayment();
  request.mockImplementation(async method => {
    if (method === 'cancelPayment') throw new Error('Could not cancel');
    return { payment };
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Back to description' }));
  expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  expect(mockActionError).toHaveBeenCalled();
  request.mockImplementation(async () => ({ payment: { ...payment, state: 'prepared' } }));
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh status' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Go to amount step' })).toBeDisabled());
  expect(screen.queryByRole('button', { name: 'Back to description' })).toBeNull();
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
  await reviewPayment();
  await fireEvent.press(screen.getByRole('button', { name: 'New payment' }));
  expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
  expect(screen.getByLabelText('Recipient handle').props.value).toBe('');
});
