/* Apply the light palette before the first paint, regardless of an old saved
   preference or the operating system theme. The theme switcher is hidden. */
document.documentElement.dataset.theme = "light";
window.citrusTheme = {
  current: () => "light",
  set: () => {},
  subscribe: () => () => {},
};
