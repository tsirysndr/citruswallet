import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider, createStore } from "jotai";
export function renderComponent(element, { store = createStore() } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return {
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={client}>{element}</QueryClientProvider>
      </Provider>,
    ),
    store,
    client,
  };
}
