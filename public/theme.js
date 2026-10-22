/* Resolves the viewer's theme into a data-theme attribute before the page
   paints, so the stylesheet needs one block per theme and nothing flashes.
   Loaded without defer, ahead of app.js; the content policy forbids inline
   scripts, so this cannot live in the document. */
(() => {
  const root = document.documentElement;
  const key = 'citruswallet-theme';
  const query = matchMedia('(prefers-color-scheme: dark)');
  const stored = () => {
    try {
      const value = localStorage.getItem(key);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };
  const apply = theme => { root.dataset.theme = theme; };
  const system = () => query.matches ? 'dark' : 'light';

  apply(stored() ?? system());
  /* Keep following the system until the viewer picks a side. */
  query.addEventListener('change', () => { if (!stored()) apply(system()); });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const label = () => {
      const dark = root.dataset.theme === 'dark';
      button.textContent = dark ? '☀ Light' : '☾ Dark';
      button.setAttribute('aria-label', `Switch to the ${dark ? 'light' : 'dark'} theme`);
    };
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(key, next);
      } catch { /* A private window simply forgets the choice. */ }
      label();
    });
    label();
  });
})();
