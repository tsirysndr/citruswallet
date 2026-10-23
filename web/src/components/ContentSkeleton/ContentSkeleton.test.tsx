import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ContentSkeleton } from './ContentSkeleton';
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
