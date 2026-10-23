import React from 'react';
import { act } from '@testing-library/react-native';
import { createStore } from 'jotai';
import { renderComponent } from './render';
import { noticeAtom } from '../src/state';
import { useNoticeTimeout } from '../src/useNoticeTimeout';
function Notices() { useNoticeTimeout(); return null; }
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test('automatically dismisses push confirmation after four seconds', () => {
  const store = createStore();
  store.set(noticeAtom, 'Push notifications enabled.');
  renderComponent(<Notices />, { store });
  act(() => jest.advanceTimersByTime(3999));
  expect(store.get(noticeAtom)).toBe('Push notifications enabled.');
  act(() => jest.advanceTimersByTime(1));
  expect(store.get(noticeAtom)).toBe('');
});
test('does not dismiss an error that replaces the confirmation', () => {
  const store = createStore();
  store.set(noticeAtom, 'Push notifications enabled.');
  renderComponent(<Notices />, { store });
  act(() => store.set(noticeAtom, 'Connection failed.'));
  act(() => jest.advanceTimersByTime(4000));
  expect(store.get(noticeAtom)).toBe('Connection failed.');
});
