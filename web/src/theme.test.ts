import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
const source = readFileSync('web/public/theme.js', 'utf8');
function boot(storage = new Map<string, string>()) {
  const meta = { setAttribute: vi.fn() };
  const document = { documentElement: { dataset: {} as { theme?: string } }, querySelectorAll: () => [meta] };
  const listeners: Record<string, (event: { key: string; newValue: string }) => void> = {};
  const window = {} as Window;
  runInNewContext(source, { window, document, localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) }, addEventListener: (key: string, listener: typeof listeners[string]) => { listeners[key] = listener; } });
  return { theme: window.peachletTheme, document, meta, listeners };
}
describe('saved appearance', () => {
  it('persists and restores dark theme before first paint, including PWA chrome', () => {
    const storage = new Map<string, string>();
    const first = boot(storage);
    const listener = vi.fn(); first.theme.subscribe(listener);
    first.theme.set('dark');
    expect(listener).toHaveBeenCalledOnce();
    const next = boot(storage);
    expect(next.theme.current()).toBe('dark');
    expect(next.document.documentElement.dataset.theme).toBe('dark');
    expect(next.meta.setAttribute).toHaveBeenCalledWith('content', '#000000');
    next.theme.set('light'); expect(boot(storage).theme.current()).toBe('light');
  });
  it('synchronizes preference changes from another tab', () => {
    const app = boot(); app.listeners.storage!({ key: 'peachlet-appearance', newValue: 'dark' });
    expect(app.theme.current()).toBe('dark');
  });
});
