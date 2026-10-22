const unavailable = {
  current: () => "light" as Theme,
  set: () => {},
  subscribe: () => () => {},
};

export const theme = window.citrusTheme ?? unavailable;
