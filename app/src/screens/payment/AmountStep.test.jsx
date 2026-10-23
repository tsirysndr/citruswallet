import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { AmountStep } from './AmountStep';
test('shows the recipient display name and handle without a note field on the amount screen', () => {
  renderComponent(<AmountStep actor={{ displayName: 'Alice', handle: 'alice.test', avatar: null }}
    handle="alice.test" amount="1" onAmount={() => {}} onContinue={() => {}} />);
  expect(screen.getByText('Sending to')).toBeTruthy();
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.getByText('@alice.test')).toBeTruthy();
  expect(screen.queryByLabelText('Description (optional)')).toBeNull();
});
