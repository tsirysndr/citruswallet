import type { ReactNode } from "react";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider, createStore } from "jotai";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach } from "vitest";
const clients = new Set<QueryClient>();
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.clear();
});
export async function renderComponent(
  ui: ReactNode,
  options: { store?: ReturnType<typeof createStore>; path?: string } = {},
) {
  const store = options.store ?? createStore();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  clients.add(client);
  const root = createRootRoute({ component: () => <>{ui}</> });
  const routes = [
    "/",
    "/wallet",
    "/settings",
    "/payments",
    "/activity",
    "/privacy",
    "/terms",
  ].map((path) => createRoute({ getParentRoute: () => root, path }));
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [options.path ?? "/"] }),
  });
  await router.load();
  const result = render(
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Provider>,
  );
  return { ...result, store, client, router, user: userEvent.setup() };
}
export * from "@testing-library/react";
