# Citrus Wallet

Pay someone by their AT Protocol handle instead of their Ethereum address.

An Ethereum address is 42 characters of hex that nobody can check by eye, so sending ETH to a person means trusting an address copied from somewhere. An AT Protocol handle — `alice.bsky.social` — is something you already recognise. Citrus Wallet connects the two: you prove you control an address by signing a message naming your AT Protocol account in MetaMask, and from then on people can pay you by handle.

Sending works in the open. You type a handle, the server resolves it to the account's stable DID and the address that account chose to receive on, and shows you the full address, the pinned DID, the network and the amount. Nothing moves until you approve the actual transaction in MetaMask, which is the only thing that signs or broadcasts it.

If the person you want to pay has not set up a receiving address yet, you create an invitation instead — a link that reserves no funds and promises nothing. They open it, sign in as the account the invitation names, link a wallet, and choose an address to share with you alone, which can stay private from everyone else. You then come back and approve the transfer as usual.

Identity is pinned when the payment is created, so a handle that later changes hands cannot redirect it, and a receiving address that changes forces you to review the payment again before it can be sent.

The server holds no keys, signs nothing, and never takes custody: there is no escrow, no deployed contract, and no automatic payout. It records the signed proofs linking accounts to addresses, keeps track of payment intents, and checks a broadcast transaction against what you reviewed. Native ETH to ordinary wallet accounts, on Ethereum mainnet or a local Anvil chain.

## Local development

Requires Bun, Node.js 24+, Gleam 1.19+, and a desktop browser with MetaMask.

```sh
bun install
bun run dev:local
```

Open **http://127.0.0.1:3000**, using that exact origin. This starts the app and Anvil (RPC `http://127.0.0.1:8545`, chain **31337** / `0x7a69`), and uses `data/local.sqlite`. Ctrl+C stops both processes. The launcher refuses to reuse an existing node on port 8545. Anvil starts fresh each run; the app's database persists.

MetaMask offers to add/switch to Anvil. For funded test accounts, import Anvil's printed development private keys into separate MetaMask test accounts. **These public development keys must never hold real funds.** Linking a wallet requires no ETH; sending requires ETH for the amount and network fees.

AT Protocol login still uses your actual account provider over the internet. The app has no mock-login route or local PDS. Use separate browser profiles to test two different AT Protocol identities. `127.0.0.1` on a phone refers to the phone, so the defaults target a desktop browser on your development machine.

### Send to an existing recipient

1. Both users sign in with their AT Protocol accounts and link a wallet on the same network.
2. The recipient checks **Allow public payments to this address** when linking. Their first public wallet on that chain becomes the receiving default. They can change it with **Make default**.
3. The sender resolves the recipient's handle, reviews the returned DID, enters an ETH amount, and creates a payment intent.
4. The sender reviews the full address, pinned DID, network, and amount, then checks the acknowledgement and selects **Review in MetaMask & send**.
5. MetaMask displays the actual transaction and fee. After approval, use **Refresh status** to check the transaction against the server's RPC and the required confirmations.

### Invite someone without a receiving address

1. Resolve their handle/DID and create a payment intent. It shows **Awaiting recipient setup**. No funds move or become reserved.
2. Copy the generated invitation URL and share it yourself. The app does not send messages or notifications.
3. The recipient opens it, signs in as the intended DID, links a wallet, and selects **Use this address for this payment**. The chosen address may stay private from other users; this sender can see it.
4. The sender returns to their payment history, opens the intent, refreshes its status, and reviews/approves the transfer in MetaMask.

The invitation is **not a funded claim link** and does not promise that the sender will pay. Intents expire after seven days. Only the pinned recipient DID can accept, even if the original handle changes hands. Invitation tokens are hashed at rest; generating a new invitation invalidates the old link. URL fragments keep the initial token out of ordinary page request URLs, and the frontend preserves it in session storage across OAuth redirects.

### Theme

The interface is built from the five colors of the [Citrus Zest palette](https://www.color-hex.com/color-palette/1010711) — `#ff9234`, `#ffcd3c`, `#fefed5`, `#e8fcd1`, `#35d0ba` — plus neutrals derived from the teal hue. Both themes live in `public/style.css` as one token block each, and every color in the stylesheet is a token: re-skinning the app means editing those two blocks and nothing else.

The header carries a light/dark switcher. `public/theme.js` resolves the preference into a `data-theme` attribute before the page paints — it loads without `defer`, ahead of `app.js`, because the page's content policy forbids inline scripts — so nothing flashes the wrong palette. Until you pick a side it follows the operating system, including when that changes while the page is open; your choice is then remembered per browser, and a browser that refuses storage still switches for the session.

Text pairings meet WCAG AA at their own sizes in both themes. Generated avatar placeholders are kept inside the palette's own arc, from orange through yellow to teal.

### Handle suggestions

Both handle fields — sign-in and recipient — suggest accounts as you type: a rounded avatar (or a generated placeholder with the initial), the display name, and the `@handle`. Arrow keys and Enter pick one; Escape closes the list.

Suggestions come from an AT Protocol AppView's typeahead, called by **this server** rather than the browser, so the page keeps its `connect-src 'self'` policy and your keystrokes are not sent to a third party by the page itself. The server drops any result it would refuse to address anyway — an invalid handle, or a DID method this app does not support — and only passes through an avatar URL on an allow-listed HTTPS host, which is also the only remote host added to the page's `img-src`. Avatar images are then loaded by the browser from that CDN directly, with `referrerpolicy="no-referrer"`; anything else falls back to the placeholder.

A suggestion is a convenience, never a source of truth: picking one only fills the field. The identity is still resolved and verified in both directions through `/api/recipients/resolve` before a payment intent can name it.

### Account balances

The linked-addresses panel shows each address's balance on the active chain, read through MetaMask's own provider with `eth_getBalance`. No server RPC is involved, and no connection prompt is triggered: balances simply stay hidden until MetaMask is connected and on the configured network. **Refresh balances** re-reads them.

## Database and migrations

The schema is defined in Gleam, one module per table, under `src/citruswallet/drizzle/schema/`. Those modules build real Drizzle tables, so they are the single source of truth for both queries and migrations: `drizzle/schema.mjs` re-exports the compiled tables for `drizzle-kit`, which generates the SQL in `drizzle/`.

```sh
bun run db:generate   # gleam build, then drizzle-kit generate
bun run db:check
```

The server applies pending migrations at startup, so no separate migrate step is needed. There is no raw SQL in the Gleam code: every query goes through the typed Drizzle bindings in `src/citruswallet/drizzle/orm.gleam`. The only SQL text anywhere is the two partial-index predicates in the schema modules, which Drizzle expresses as SQL in any language, and the three connection `PRAGMA`s in `src/citruswallet/ffi/better_sqlite.gleam`.

The same Ethereum address can be independently linked on different chains, with at most one DID owning an `(address, chain)` association. Each DID has at most one public receiving default per chain.

## Mainnet / configuration

```sh
bun run dev
```

This defaults to Ethereum mainnet (chain 1), with `data/wallet.sqlite`. Linking, recipient resolution, and invitations work without an Ethereum RPC. Sending requires a trusted **server-side** `ETH_RPC_URL` for that chain. The URL is never included in API responses. Anvil RPC is configured automatically in `dev:local`.

See `.env.example`. Variables are read from the process; to explicitly load an `.env` file, export it into the environment before starting the app.

| Variable | Default / meaning |
| --- | --- |
| `APP_URL` | `http://127.0.0.1:3000`; exact origin, no trailing slash |
| `PORT`, `HOST` | `3000`, `127.0.0.1` |
| `EVM_CHAIN_ID` | `1`; `31337` allowed only with a loopback app origin |
| `ETH_RPC_URL` | Required for mainnet payments; loopback HTTP or HTTPS |
| `DATABASE_PATH` | `data/wallet.sqlite`, or `data/local.sqlite` on Anvil |
| `MIGRATIONS_DIR` | `./drizzle`; applied at startup |
| `PUBLIC_DIR` | `./public`; static frontend, resolved against the working directory |
| `APPVIEW_URL` | `https://public.api.bsky.app`; HTTPS or loopback, serves handle suggestions |
| `TRUST_PROXY_HOPS` | `0`; set only for your trusted reverse-proxy topology |

For HTTPS hosting, make `/client-metadata.json` publicly reachable by the user's OAuth server and use a persistent, access-controlled database volume. HTTPS enables Secure cookies and HSTS. Use a single Node process; multiple workers require shared OAuth locking, shared rate limiting, and coordinated database access.

Request rate limiting is built in: 60 requests per minute per client across `/api` and `/auth`, counted in a fixed window in the database and reported with `RateLimit-Policy` and `RateLimit` headers. Handle suggestions are metered separately, at 240 per minute, so a burst of keystrokes cannot spend the budget that payment requests need. The client address comes from the socket unless `TRUST_PROXY_HOPS` says how many proxy hops to trust, so a forwarded header cannot invent more hops than you configure.

## Payment behavior and recovery

Handles are resolved with the official identity SDK's SSRF-protected fetch. The DID document must claim the handle and match the resolved DID. A sender previews the DID; creation resolves it again and rejects a changed identity. After creation, the recipient DID is pinned. The displayed handle is a creation-time label and cannot retarget the intent.

A public default can change while an intent is awaiting preparation; this increments its revision and requires another sender review. Private invitation choices are scoped to that payment. Unlinking a receiving wallet invalidates its use for new preparation. Preparing freezes the destination and reserves a specific sender nonce in the app, so repeated preparation returns the same transaction instead of creating another send.

The sender's MetaMask account must be linked to their authenticated DID on the payment network. The server verifies its RPC's chain before preparation. The frontend checks the prepared transaction against the reviewed address, amount, DID, and chain, then invokes `eth_sendTransaction`. Only MetaMask signs and broadcasts it.

After broadcast, the server stores the transaction hash before making RPC checks. It validates the sender, recipient, value, empty call data, nonce, chain, and receipt status. Mainnet requires **12 confirmations**; Anvil requires **1**. Status is checked on demand with **Refresh status**. A missing transaction or RPC outage is never treated as success. Previously checked receipts are rechecked when you refresh an individual payment, so a missing receipt can return it to submitted status.

If the page loses the response after wallet approval, check MetaMask before retrying. A broadcast hash is preserved in the current tab's session storage until the server accepts it. The review panel also lets you attach the original transaction hash manually. An unresolved wallet request blocks another send in that tab until you recover its hash or explicitly indicate that no transaction was sent. A declined wallet request can retry the same prepared intent/nonce. Preparing reserves no funds and creates no on-chain lock.

Only unprepared intents can be cancelled in the app. An expired prepared intent releases its app-level nonce reservation on subsequent preparation, while retaining its attempt metadata so an already broadcast transaction can still be reported. Expiry and cancellation are off-chain workflow states: they cannot revoke a transaction already signed/broadcast or close a wallet prompt. The wallet's final approval is authoritative; changing transaction fields in MetaMask can cause the resulting transfer to fail this app's verification.

## API

Authenticated mutations require the HttpOnly cookie, exact `Origin`, and `x-csrf-token` from `/api/session`. All request bodies are JSON, limited to 8 KiB. Payment history is accessible only to its sender; invitations are accessible only to the intended authenticated recipient.

| Method | Endpoint | Purpose / body |
| --- | --- | --- |
| GET | `/api/session` | DID, CSRF token, linked wallets, network, `paymentsEnabled` |
| POST | `/auth/start` | `{ identifier }` → authorization URL |
| GET | `/auth/callback` | OAuth callback, rotates browser session |
| POST | `/api/challenge` | `{ address, public?: boolean }` → five-minute DID-bound SIWE challenge |
| POST | `/api/verify` | `{ id, signature }` → verify and consume challenge atomically |
| POST | `/api/links/default` | `{ address }` → choose a public receiving default for the active chain |
| DELETE | `/api/links/:address` | Unlink the current DID's wallet on the active chain |
| GET | `/api/resolve/:did` | Public links, chain IDs, proofs, and default flags |
| GET | `/api/actors/search?q=` | Handle suggestions: DID, handle, display name, avatar |
| POST | `/api/recipients/resolve` | `{ identifier }` → verified DID/handle and active-chain default |
| POST | `/api/payments` | `{ identifier, expectedDid, amount }` → intent and invitation URL; amount is a decimal ETH string |
| GET | `/api/payments` | Sender's most recent 50 intents on the active chain |
| GET | `/api/payments/:id` | Refresh one intent and verify any reported transaction |
| POST | `/api/payments/:id/invitation` | Rotate/generate an unfunded invitation URL |
| POST | `/api/payments/:id/cancel` | Cancel a waiting/ready intent |
| POST | `/api/payments/:id/prepare` | `{ revision, address, fromAddress }` → immutable payment attempt and wallet transaction |
| POST | `/api/payments/:id/submit` | `{ attemptId, txHash }` → record hash and check on-chain status |
| GET | `/api/invitations/:token` | Read invitation as its intended recipient |
| POST | `/api/invitations/:token/accept` | `{ address }` → select one of the recipient's linked wallets |
| POST | `/api/logout` | Invalidate this browser session and pending linking challenges |
| GET | `/client-metadata.json` | OAuth client metadata |

## Validation and Foundry workspace

```sh
bun run check
bun run test
bun run build
bun run start
```

`bun run test` covers identifier and amount validation, network configuration, the expiring key/value table, challenge issuance, link listing and receiving defaults, payment creation and pinning, invitation scoping and rotation, cancellation, preparation without an RPC, suggestion vetting and avatar allow-listing, and rate limiting, using an in-memory database migrated by drizzle-kit and an injected identity resolver.

`foundry.toml` reserves the `contracts/` workspace and an `anvil` RPC alias. Anvil is included as a dev dependency. For future Solidity work, install the full [Foundry toolchain](https://getfoundry.sh/introduction/installation/) and add contracts/tests before running `forge build` / `forge test`. Wallet linking and these payments need no deployed contract.

## Implementation

Written in Gleam, compiled to JavaScript and run on Node.js, with Hono, the official AT Protocol OAuth and identity SDKs, viem, Drizzle ORM over SQLite, and Foundry Anvil for local development.

Every dependency binding is written in Gleam. `src/ffi.mjs` is the only JavaScript on the server: a generic bridge for the few constructs Gleam cannot express (property access, method calls, `new`, object literals, thrown exceptions, BigInt, mutable cells). It contains no application logic and knows about no package.

## Source and trust model

- `src/citruswallet.gleam`: startup, configuration, and shutdown.
- `src/citruswallet/app.gleam`: HTTP routes, sessions, CSRF, host and rate-limit middleware.
- `src/citruswallet/oauth.gleam`, `src/citruswallet/identity.gleam`: official OAuth client and bidirectional identity resolution.
- `src/citruswallet/directory.gleam`: AppView handle suggestions, vetted before they reach the page.
- `src/citruswallet/linking.gleam`: SIWE challenges, verification, wallet ownership, and receiving defaults.
- `src/citruswallet/payments.gleam`, `src/citruswallet/chain.gleam`: unfunded intents, recipient invitations, preparation, and RPC verification.
- `src/citruswallet/store.gleam`, `src/citruswallet/drizzle/`: schema, migrations, typed queries, and session state.
- `src/citruswallet/network.gleam`, `src/citruswallet/validate.gleam`, `src/citruswallet/rate_limit.gleam`, `src/citruswallet/error.gleam`: chain configuration, input shapes, request limits, and failures.
- `src/citruswallet/ffi/`: Gleam bindings for Hono, Drizzle, better-sqlite3, viem, the AT Protocol SDKs, Node, `fetch`, and `URL`.
- `public/`: responsive frontend, Citrus Zest theme with a light/dark switcher, MetaMask integration, handle suggestions, and balance display.
- `scripts/`: Anvil + app launcher.

The wallet signature proves that the Ethereum account signed a message naming the DID. DID-owner consent relies on this app's OAuth verification; a copied wallet signature alone is not an independently verifiable DID-owner attestation. Public resolution and recipient selections are app-local database state, not on-chain or PDS records. Consumers trust this server's mapping and configured RPC. Handle suggestions additionally trust the configured AppView for discovery only, and loading a suggested avatar reveals the viewer's IP address to that image CDN; neither affects what the app will accept as a payment recipient.

Only the base `atproto` OAuth scope is requested, with no repository write permissions. OAuth credentials are discarded after authentication. Browser sessions and temporary OAuth state are sensitive; keep the SQLite files private. Wallet keys, seed phrases, and transaction-signing credentials never reach the server.

Supported assets/wallets: native ETH and standard externally owned accounts on chain 1 or 31337. ERC-20 transfers, contract wallets/ERC-1271, WalletConnect, escrow, automatic payouts, wallet-based account recovery, and PDS record publication are outside this implementation. Real provider login and the actual MetaMask extension prompts still require manual testing with your own accounts.
