import React from 'react';
import { render, screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { Text, TextInput } from './Typography';
test('uses Rockford for interface text and preserves monospace for addresses', () => {
  render(<><Text className="font-semibold">Send ETH</Text><Text className="font-mono">0x1234</Text></>);
  expect(screen.getByText('Send ETH')).toHaveStyle({ fontFamily: 'RockfordBold' });
  expect(screen.getByText('0x1234')).not.toHaveStyle({ fontFamily: 'Rockford' });
});
test('forwards accessible input and editing', async () => {
  const change = jest.fn(); render(<TextInput accessibilityLabel="Handle" value="" onChangeText={change} />);
  await fireEvent.changeText(screen.getByLabelText('Handle'), 'alice.test');
  expect(change).toHaveBeenCalledWith('alice.test');
});

test('preserves bold weight on monospaced balance amounts', () => {
  render(<Text className="font-mono font-bold">1.234 ETH</Text>);
  expect(screen.getByText('1.234 ETH')).toHaveStyle({ fontWeight: '700' });
  expect(screen.getByText('1.234 ETH')).not.toHaveStyle({ fontFamily: 'RockfordBold' });
});
