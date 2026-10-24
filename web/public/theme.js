/* Apply the saved palette before first paint, including installed PWAs. */
(() => {
  const key = "peachlet-appearance";
  const listeners = new Set();
  let current = "light";
  try {
    if (localStorage.getItem(key) === "dark") current = "dark";
  } catch {}
  const apply = (value) => {
    current = value;
    document.documentElement.dataset.theme = value;
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) =>
        meta.setAttribute("content", value === "dark" ? "#000000" : "#f7f3f0"),
      );
    listeners.forEach((listener) => listener());
  };
  window.peachletTheme = {
    current: () => current,
    set: (value) => {
      if (value !== "light" && value !== "dark") return;
      try {
        localStorage.setItem(key, value);
      } catch {}
      apply(value);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  addEventListener("storage", (event) => {
    if (event.key === key || event.key === null)
      apply(event.newValue === "dark" ? "dark" : "light");
  });
  apply(current);
})();
