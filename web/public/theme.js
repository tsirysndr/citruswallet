/* Resolves the viewer's theme into a data-theme attribute before the page
   paints, so the stylesheet needs one block per theme and nothing flashes.
   Loaded without defer, ahead of the bundle; the content policy forbids
   inline scripts, so this cannot live in the document. */
(() => {
  const root = document.documentElement;
  const key = "citruswallet-theme";
  const query = matchMedia("(prefers-color-scheme: dark)");
  const listeners = new Set();
  const stored = () => {
    try {
      const value = localStorage.getItem(key);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };
  const apply = (theme) => {
    root.dataset.theme = theme;
    for (const listener of listeners) listener();
  };
  const system = () => (query.matches ? "dark" : "light");

  apply(stored() ?? system());
  /* Keep following the system until the viewer picks a side. */
  query.addEventListener("change", () => {
    if (!stored()) apply(system());
  });

  window.citrusTheme = {
    current: () => (root.dataset.theme === "dark" ? "dark" : "light"),
    set(theme) {
      apply(theme);
      try {
        localStorage.setItem(key, theme);
      } catch { /* A private window simply forgets the choice. */ }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();
