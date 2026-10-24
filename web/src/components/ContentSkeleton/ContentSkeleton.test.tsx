import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ContentSkeleton } from './ContentSkeleton';
import { theme } from '../../theme';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('renders labeled animated placeholders with distinct SVG identifiers', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  const { container } = render(<><ContentSkeleton label="Loading payments" /><ContentSkeleton label="Loading balance" variant="line" /></>);
  expect(screen.getByRole('status', { name: 'Loading payments' })).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('animateTransform')).toHaveLength(2);
  const ids = [...container.querySelectorAll('clipPath')].map(node => node.id);
  expect(new Set(ids).size).toBe(2);
});
it('keeps placeholders static when reduced motion is requested', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  const { container } = render(<ContentSkeleton variant="media" />);
  expect(container.querySelector('animateTransform')).toBeNull();
  expect(container.querySelectorAll('clipPath rect')).toHaveLength(6);
});
it('updates the shimmer colors when appearance changes without remounting', () => {
  let current: Theme = 'light';
  let notify = () => {};
  vi.spyOn(theme, 'current').mockImplementation(() => current);
  vi.spyOn(theme, 'subscribe').mockImplementation(listener => { notify = listener; return () => {}; });
  const { container } = render(<ContentSkeleton />);
  const colors = () => [...container.querySelectorAll('stop')].map(stop => stop.getAttribute('stop-color'));
  expect(colors()).toEqual(['#e4e5dc', '#f5f7ee', '#e4e5dc']);
  act(() => { current = 'dark'; notify(); });
  expect(colors()).toEqual(['#292929', '#404040', '#292929']);
  act(() => { current = 'light'; notify(); });
  expect(colors()).toEqual(['#e4e5dc', '#f5f7ee', '#e4e5dc']);
});
it('keeps balance-card loaders neutral and dark in either appearance', () => {
  const { container } = render(<ContentSkeleton inverse />);
  expect(container.querySelector('stop')).toHaveAttribute('stop-color', '#292929');
});
