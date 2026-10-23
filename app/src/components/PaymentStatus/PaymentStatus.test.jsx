import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { PaymentStatus } from './PaymentStatus';
test('keeps the readable status label with an accent color', () => {
  renderComponent(<PaymentStatus state="confirmed" />);
  expect(screen.getByText('Confirmed')).toHaveStyle({ color: '#315417' });
});
