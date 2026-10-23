import React, { useState } from 'react';
import { render, screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { AmountPad } from './AmountPad';
function Composer() { const [value, setValue] = useState('0'); return <AmountPad value={value} onChange={setValue} />; }
test('composes a decimal without opening a system keyboard and supports delete and clear', async () => {
  render(<Composer />);
  await fireEvent.press(screen.getByRole('button', { name: '1' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Decimal separator' }));
  await fireEvent.press(screen.getByRole('button', { name: '5' }));
  expect(screen.getByLabelText('Amount 1.5 ETH')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete last digit' }));
  expect(screen.getByLabelText('Amount 1. ETH')).toBeTruthy();
  await fireEvent(screen.getByRole('button', { name: 'Delete last digit' }), 'longPress');
  expect(screen.getByLabelText('Amount 0 ETH')).toBeTruthy();
});
