import React from 'react';
import { FlatList } from 'react-native';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { renderComponent } from './render';
import { Activity } from '../src/screens/Activity';
import { request } from '../src/api';
jest.mock('../src/hooks', () => ({ useSession: () => ({ data: { did: 'did:plc:me', network: { chainId: 1 } } }), useAction: () => fn => fn() }));
jest.mock('../src/api', () => ({ request: jest.fn() }));
const makePayment = id => ({ id, senderDid: 'did:plc:me', recipientLabel: `Recipient ${id}`, amount: '1', state: 'confirmed', createdAt: '2026-10-01T12:00:00Z' });
const firstPage = Array.from({ length: 20 }, (_, i) => makePayment(`p${i}`));
const items = () => screen.UNSAFE_getByType(FlatList).props.data;
beforeEach(() => request.mockReset());
test('scroll appends results, deduplicates overlaps, stops at the end and resets for search', async () => {
  request.mockImplementation(async (_method, _body, params) => params.q ? { payments: [makePayment('search')], total: 1 } :
    { payments: params.page === 1 ? firstPage : [firstPage[19], makePayment('p20')], total: 22 });
  renderComponent(<Activity />);
  await waitFor(() => expect(items()).toHaveLength(20));
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  await fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached');
  await waitFor(() => expect(items()).toHaveLength(21));
  expect(items()[0].id).toBe('p0');
  const calls = request.mock.calls.length;
  await fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached');
  expect(request).toHaveBeenCalledTimes(calls);
  await fireEvent.changeText(screen.getByLabelText('Search payments'), 'search');
  await waitFor(() => expect(items().map(item => item.id)).toEqual(['search']));
  expect(request).toHaveBeenLastCalledWith('listPayments', undefined, expect.objectContaining({ q: 'search', page: 1 }));
});
test('a failed next batch retains previous results and can be retried', async () => {
  let failed = true;
  request.mockImplementation(async (_method, _body, params) => {
    if (params.page === 2 && failed) throw new Error('Offline');
    return { payments: params.page === 1 ? firstPage : [makePayment('last')], total: 21 };
  });
  renderComponent(<Activity />);
  await waitFor(() => expect(items()).toHaveLength(20));
  await fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Could not load more. Retry' })).toBeTruthy());
  expect(items()).toHaveLength(20);
  failed = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Could not load more. Retry' }));
  await waitFor(() => expect(items()).toHaveLength(21));
});
