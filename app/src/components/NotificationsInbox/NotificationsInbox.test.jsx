import React from 'react';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { NotificationsInbox } from './NotificationsInbox';
import { request } from '../../api';
import { reviewAtom, screenAtom } from '../../state';
let mockSession;
jest.mock('../../hooks', () => ({ useSession: () => ({ data: mockSession }), useAction: () => fn => fn() }));
jest.mock('../../api', () => ({ request: jest.fn() }));
jest.mock('../../notifications', () => ({ enablePush: jest.fn(), disablePush: jest.fn() }));
beforeEach(() => {
  mockSession = { did: 'did:plc:me' };
  request.mockReset();
  request.mockResolvedValue({ unread: 1, notifications: [{ id: 'notice1', paymentId: 'payment1', createdAt: '1700000000000', read: false }] });
});
test('does not expose notifications while signed out', () => {
  mockSession = null; renderComponent(<NotificationsInbox />);
  expect(screen.queryByLabelText(/Notifications/)).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
test('marks an opened notification read and navigates to its payment', async () => {
  const { store } = renderComponent(<NotificationsInbox />);
  await waitFor(() => expect(screen.getByLabelText('Notifications, 1 unread')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Notifications, 1 unread'));
  await fireEvent.press(screen.getByText('View payment →'));
  await waitFor(() => expect(store.get(reviewAtom)).toBe('payment1'));
  expect(request).toHaveBeenCalledWith('markNotificationRead', { id: 'notice1' });
  expect(store.get(screenAtom)).toBe('Payments');
  expect(screen.queryByText('View payment →')).toBeNull();
});

test('marks all notifications as read', async () => {
  renderComponent(<NotificationsInbox />);
  await fireEvent.press(await screen.findByLabelText('Notifications, 1 unread'));
  await fireEvent.press(screen.getByText('Mark all as read'));
  expect(request).toHaveBeenCalledWith('markAllNotificationsRead', {});
});
