import React from 'react';
import { render, fireEventAsync as fireEvent, screen, waitFor, within, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackHandler } from 'react-native';
import { Provider, createStore } from 'jotai';
import { reviewAtom, screenAtom } from '../src/state';
import { sendPayment } from '../src/wallet';
import { Payments } from '../src/screens/Payments';
import { request } from '../src/api';

const mockActionError = jest.fn();
const mockSession = { did: 'did:plc:me', network: { name: 'Ethereum', chainId: 1 }, paymentsEnabled: true };
jest.mock('../src/hooks', () => ({ useSession: () => ({ data: mockSession }), useAction: () => fn => fn().catch(mockActionError) }));
jest.mock('../src/api', () => ({ request: jest.fn() }));
jest.mock('../src/wallet', () => ({ pending: jest.fn(async () => null), recover: jest.fn(), sendPayment: jest.fn() }));
jest.mock('../src/klipy', () => ({ recordShare: jest.fn(), klipyEnabled: false, mediaKinds: [], fetchMedia: jest.fn() }));
const alice = { did: 'did:plc:alice', handle: 'alice.bsky.social', displayName: 'Alice', avatar: 'https://example.com/alice.jpg' };
const payment = { id: 'payment1', senderDid: 'did:plc:me', recipientDid: alice.did, recipient: alice, recipientLabel: alice.handle, amount: '1', state: 'ready', address: '0x123', revision: 1 };
function mount(element, store = createStore()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<Provider store={store}><QueryClientProvider client={client}>{element}</QueryClientProvider></Provider>);
}
beforeEach(() => {
  request.mockReset();
  mockActionError.mockReset();
  request.mockImplementation(async method => method === 'resolveRecipient' ? { did: alice.did, handle: alice.handle } : { payment });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ actors: [alice, { ...alice, did: mockSession.did, handle: 'me.bsky.social' }] }) }));
});
async function enterAmount() {
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), alice.handle);
  await fireEvent(screen.getByLabelText('Recipient handle'), 'submitEditing');
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
  await fireEvent(screen.getByLabelText('Recipient handle'), 'submitEditing');
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
test('starting a new payment resets the draft and returns to recipient selection', async () => {
  mount(<Payments />);
  await reviewPayment();
  await fireEvent.press(screen.getByRole('button', { name: 'New payment' }));
  expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
  expect(screen.getByLabelText('Recipient handle').props.value).toBe('');
});

test('reports each step to the shell so navigation can stay hidden during composition', async () => {
  const changed = jest.fn();
  mount(<Payments onStepChange={changed} />);
  expect(changed).toHaveBeenLastCalledWith(1);
  await enterDescription();
  expect(changed).toHaveBeenLastCalledWith(3);
  await fireEvent.press(screen.getByRole('button', { name: 'Go to recipient step' }));
  expect(changed).toHaveBeenLastCalledWith(1);
});

test('copy and share use the invitationUrl response without rotating the same link', async () => {
  const Clipboard = require('expo-clipboard');
  const Share = require('react-native').Share;
  const url = 'https://citruswallet.app/invite#invite=' + 'a'.repeat(64);
  const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  request.mockImplementation(async method => method === 'resolveRecipient' ? { did: alice.did, handle: alice.handle } :
    method === 'createInvitation' ? { invitationUrl: url } : { payment });
  mount(<Payments />);
  await reviewPayment();
  await fireEvent.press(screen.getByRole('button', { name: 'Copy invitation link' }));
  expect(copy).toHaveBeenCalledWith(url);
  await fireEvent.press(screen.getByRole('button', { name: 'Share payment invitation' }));
  expect(share).toHaveBeenCalledWith({ message: url });
  expect(request.mock.calls.filter(([method]) => method === 'createInvitation')).toHaveLength(1);
  copy.mockRestore(); share.mockRestore();
});

test('selecting a recipient advances immediately using their DID without a continue button', async () => {
  mount(<Payments />);
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  await fireEvent(screen.getByLabelText('Recipient handle'), 'focus');
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), 'alice');
  await waitFor(() => expect(screen.getByRole('button', { name: `Use @${alice.handle}` })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: `Use @${alice.handle}` }));
  await waitFor(() => expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy());
  expect(request).toHaveBeenCalledWith('resolveRecipient', { identifier: alice.did });
});
test('keyboard mode hides recipient headings and step navigation', () => {
  mount(<Payments keyboardVisible />);
  expect(screen.getByLabelText('Recipient handle')).toBeTruthy();
  expect(screen.queryByText('Who are you paying?')).toBeNull();
  expect(screen.queryByLabelText('Step 1 of 4')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Go to amount step' })).toBeNull();
});
test('failed recipient resolution stays on recipient selection', async () => {
  request.mockRejectedValue(new Error('Recipient unavailable'));
  mount(<Payments />);
  await fireEvent.changeText(screen.getByLabelText('Recipient handle'), alice.handle);
  await fireEvent(screen.getByLabelText('Recipient handle'), 'submitEditing');
  expect(mockActionError).toHaveBeenCalled();
  expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
});

test.each(['waiting', 'ready', 'prepared', 'submitted', 'confirming', 'confirmed', 'failed', 'cancelled', 'expired'])('Done closes a %s payment without sending or changing its status', async state => {
  const store = createStore();
  store.set(reviewAtom, payment.id);
  store.set(screenAtom, 'Payments');
  sendPayment.mockClear();
  request.mockResolvedValue({ payment: { ...payment, state } });
  mount(<Payments />, store);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy());
  request.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(store.get(reviewAtom)).toBeNull();
  expect(store.get(screenAtom)).toBe('Activity');
  expect(sendPayment).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
