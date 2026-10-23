# Frontend tests

Run `bun run test:web` for one run, or `bun run test:web:watch` for watch mode.
Filter a component with `bun run test:web ActivitySearch`. The root `bun run test`
also runs frontend tests after the existing Gleam and Node tests. `bun run check`
type-checks components, tests, fixtures, and the Vitest configuration.

Each component lives in `components/Name/Name.tsx` alongside `Name.test.tsx`.
`index.ts` preserves the public import (`components/Name`). The shared UI module
retains its named primitive exports in `components/ui`.

Use `renderComponent` for isolated React Query, Jotai, and memory-router providers.
It returns `user`, `client`, `store`, and `router` for interaction tests and assertions.
Use accessible roles/labels and assert user-visible outcomes; avoid snapshots of
implementation markup. Query retries are disabled, and every test gets fresh
providers. DOM cleanup, query caches, storage, spies, and MSW overrides are reset.

MSW 3 intercepts requests at the network boundary in Node. Shared typed fixtures
and read-only XRPC/KLIPY handlers are in `mocks/`. Add explicit per-test
`server.use(http.post(...))` handlers for mutations, and inspect their payloads.
Unhandled network requests fail instead of reaching live services. Never mock
`fetch`, `rpc`, or query hooks just to return success. Stub the wallet provider
only when testing wallet interactions: no test connects to a real wallet.

Vitest has its own configuration, a fake KLIPY key, and no production env loading.
No service-worker mock or MSW runtime is added to the shipped app. jsdom lacks
native dialog top-layer behavior and layout; setup supplies minimal dialog and
scroll stubs. Real browser checks remain necessary for focus trapping, responsive
layout, native Escape behavior, and mobile wallet handoffs.
