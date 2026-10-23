import React from 'react';
import { render, screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { BottomTabs } from './BottomTabs';
test('exposes all four destinations and identifies the active tab', async () => {
  const change = jest.fn();
  render(<BottomTabs screen="Payments" onChange={change} />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.getByRole('tab', { name: 'Payments' })).toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
  expect(change).toHaveBeenCalledWith('Activity');
});

test('uses the same CSS shadow as mobile web without Android elevation', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const css = readFileSync(resolve(__dirname, '../../../../web/src/styles.css'), 'utf8');
  const shadow = css.match(/\.mobile-nav\s*\{[^}]*box-shadow:\s*([^;]+);/)[1].replace(/^0 /, '0px ');
  render(<BottomTabs screen="Account" onChange={() => {}} />);
  expect(screen.getByTestId('bottom-navigation')).toHaveStyle({ boxShadow: shadow });
  expect(screen.getByTestId('bottom-navigation').props.style.elevation).toBeUndefined();
});
