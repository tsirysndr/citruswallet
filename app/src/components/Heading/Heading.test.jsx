import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Heading } from './Heading';
test('renders the title and optional explanatory text', () => {
  const { rerender } = render(<Heading title="Send ETH" subtitle="Choose a recipient" />);
  expect(screen.getByText('Choose a recipient')).toBeTruthy();
  rerender(<Heading title="Send ETH" />);
  expect(screen.getByText('Send ETH')).toBeTruthy();
  expect(screen.queryByText('Choose a recipient')).toBeNull();
});
