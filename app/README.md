# Citrus Wallet for Android and iOS

Expo SDK 54, React Native, NativeWind 4, Jotai, TanStack Query and MetaMask Connect. The app has Account, Wallet, Payments and Activity tabs, a decimal-safe custom amount keypad, payment review/recovery, recipient suggestions, FTS activity search, filters and a notification inbox.

The dedicated Expo project is `@tsirysndr/citruswallet` (`4111c93c-f70b-4ed0-b80e-efdb725dd710`), with native identifier `app.citruswallet` and callback scheme `citruswallet://auth`. It uses dedicated signing credentials.

## Run

```sh
cd app
bun install --frozen-lockfile
bun run android
# Or: bun run ios
bun run start
```

Use a native development build, not Expo Go. MetaMask and SecureStore use native functionality. `EXPO_PUBLIC_API_URL` defaults to `https://citruswallet.app`; it must point to a deployment that includes the native login and notification endpoints in this change. `EXPO_PUBLIC_ETH_RPC_URL` defaults to the public mainnet RPC.

```sh
bun run typecheck
bun run test
bun run export
```

## Component tests

Run `bun run test` from `app/` for all native checks: Node's test runner covers pure amount and wallet-connection logic, and Jest with `jest-expo` and React Native Testing Library covers components. Bun launches these scripts; `bun test` is not the native-component test runner. The web app keeps its existing Vitest setup.

Each component lives in `src/components/ComponentName/` with its implementation, public `index.ts`, and colocated `ComponentName.test.jsx`. The `ui/index.ts` barrel re-exports the shared form and display primitives. Payment-flow integration tests live in `tests/payments.test.jsx`. Use `bun run test:ui:watch` while editing a component, and `tests/render.jsx` for isolated Jotai and TanStack Query providers.

## Local Android build

```sh
mise install
export ANDROID_HOME="$HOME/Library/Android/sdk"
mise exec -- bunx eas-cli build --platform android --profile preview --local --output /tmp/citruswallet-preview.apk
adb -s DEVICE_SERIAL install -r /tmp/citruswallet-preview.apk
```

`preview` produces a signed APK with the JavaScript bundle included. `production` produces a store app bundle. EAS manages the dedicated Citrus signing key. For a Pixel-only preview, `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a` reduces local build time.

The root `mise.toml` pins Temurin Java 21.0.12+8 LTS. Running the build through `mise exec` sets both Java and `JAVA_HOME` consistently.

## Authentication and payment safety

AT Protocol authorization runs in the system browser. A browser-bound OAuth callback returns a short-lived, single-use code to the app; redeeming it requires the random device-held verifier whose SHA-256 commitment was supplied at login. The redirect is fixed and never contains a session token. Native bearer sessions expire after eight hours, are stored hashed on the server, and are kept in SecureStore on the device. Browser cookie/CSRF authentication remains separate.

MetaMask deep links preserve the SDK connection request and relay response. Linking signs a server-issued challenge. Sending requires an explicit review and checks the prepared destination, amount, chain, sender and data before opening MetaMask. A SecureStore broadcast journal is written before the send request; interrupted or ambiguous broadcasts must be recovered using the original hash before another payment can be sent. A rejected request with code 4001 clears the journal. No private keys enter the app.

## Firebase / Expo push

1. Create a Firebase project and add Android package `app.citruswallet`.
2. Save its Android configuration to `app/google-services.json` (ignored by Git), or set `GOOGLE_SERVICES_JSON` to a file path before building.
   The root `.easignore` includes this client configuration in EAS build archives while excluding service-account keys and signing credentials.
3. Generate a Firebase service-account key and upload it to the Citrus Expo project's Android FCM V1 credentials. Keep this private key outside the repository and the APK.
4. Rebuild and install the APK after adding Firebase configuration.
5. Sign in, open the notification bell, and choose **Enable push notifications**. Grant the Android permission.

SSE handles foreground updates and replays missed events using a per-user cursor. Expo push handles delivery while the app is closed. Tapping a push opens the payment, which the API still authorizes against the current user. Push bodies contain no sender identity or amount. iOS background push additionally requires APNs credentials and an iOS build.

Notifications reflect verified incoming payments after the required chain confirmations. The notification API and worker must be deployed before native sign-in and payment notifications work against production. Firebase setup is required only for Android background push, not the SSE inbox.

### Android invitation links

Invitations use `https://citruswallet.app/invite#invite=<token>`. The fragment keeps the invitation token out of HTTP requests. Android verifies the release signing certificate against `/.well-known/assetlinks.json`; `app.config.js` restricts verified links to `/invite`. Keep the SHA-256 fingerprint synchronized with the release certificate. When enabling Play App Signing, add the **Play app signing certificate** fingerprint as well (not the upload certificate). Rebuild and reinstall after changing intent filters. iOS universal links are not configured yet.

The app retains pending invitations in secure storage through sign-in. Recipients must explicitly choose a linked address; opening a link never accepts an invitation or sends funds. The website remains the fallback when the app is absent and provides an explicit app-opening link for older invitations.
