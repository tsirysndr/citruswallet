import { expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';
import { renderComponent, screen } from '../../test/render';
import { RecoveryBackup } from './index';
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
it('prefills nine words and confirms only three using choices, without a text input', async () => {
  const confirmed = vi.fn();
  const { user } = await renderComponent(<RecoveryBackup phrase={phrase} onConfirmed={confirmed} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'I’ve saved my recovery phrase' }));
  const grid = within(screen.getByRole('list', { name: 'Recovery words' }));
  expect(grid.getAllByRole('listitem')).toHaveLength(12);
  expect(grid.getAllByRole('button')).toHaveLength(3);
  expect(grid.getAllByRole('listitem').filter(item => !item.querySelector('button'))).toHaveLength(9);
  for (let step = 0; step < 3; step++) {
    const group = screen.getByRole('group');
    const index = Number(group.getAttribute('aria-label')!.match(/\d+/)![0]) - 1;
    const word = phrase.split(' ')[index]!;
    const options = within(group).getAllByRole('button');
    expect(options).toHaveLength(4);
    if (step === 0) {
      await user.click(options.find(button => button.textContent !== word)!);
      expect(screen.getByRole('alert')).toHaveTextContent('Not quite');
      expect(confirmed).not.toHaveBeenCalledWith(true);
    }
    await user.click(within(group).getByRole('button', { name: word }));
  }
  expect(confirmed).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('status')).toHaveTextContent('Backup confirmed');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  await user.click(grid.getAllByRole('button')[0]!);
  expect(confirmed).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('group')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Review my recovery phrase' }));
  expect(grid.queryAllByRole('button')).toHaveLength(0);
  expect(confirmed).toHaveBeenLastCalledWith(false);
});
