# Encrypted cloud wallet backups

Peachlet supports manual Google Drive and Dropbox backup/restore on web and Android. Configure the providers below before the buttons become available. Firebase push credentials do not grant Drive access. No provider secret belongs in the frontend or APK.

The wallet is encrypted **on the device** with a separate backup password of at least 12 characters, using the existing wallet-core AES-256-GCM envelope and PBKDF2-SHA256 (600,000 iterations, random 32-byte salt and 12-byte nonce). The portable backup does not depend on an Android keystore key, biometric enrollment, or local vault pepper. Both recovery phrases and imported private keys are supported. Only the first account derived by Peachlet is included; linked external MetaMask wallets and unrelated accounts are not backed up.

Each backup is a new file. Existing backups are never overwritten or deleted. Peachlet downloads the uploaded file and compares it to the encrypted original before showing success. Restore authenticates and validates the envelope locally, then creates a new local vault. Existing wallets cannot be overwritten. Restore does not automatically change the receiving address on an Atmosphere account: complete the normal wallet-linking step.

The backup password is needed on a new device; cloud account recovery alone cannot decrypt the file. Keep an offline recovery copy. Losing both the password and recovery information makes the wallet unrecoverable. Passwords, recovery phrases, and private keys are never sent to Peachlet's API or the cloud provider in plaintext. Application code keeps OAuth access tokens in memory for at most ten minutes and does not request refresh tokens; Google's native SDK also manages its account/token cache. Signing out of Peachlet is separate from disconnecting a Google or Dropbox account.

## Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), use the same project for the web and Android OAuth clients. You may use your existing Firebase project's underlying Google Cloud project. Enable **Google Drive API**.
2. Configure Google Auth Platform branding/audience with Peachlet, `peachlet.app`, your support email, and the privacy policy/terms URLs. While the app is in testing, add the Google accounts that will test it.
3. Add the scope `https://www.googleapis.com/auth/drive.appdata`. This grants access only to this application's hidden app-data folder, not the user's whole Drive. Do not request full Drive access.
4. Create a **Web application** OAuth client. Add `https://peachlet.app` to Authorized JavaScript origins. For local testing, add the exact local origin (for example `http://localhost:5173`). The web integration uses Google Identity Services' popup token flow; it does not use a Google redirect callback or client secret.
5. Set `VITE_GOOGLE_DRIVE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com` in the root `.env.prod` (or `.env` for development).
6. Create an **Android** OAuth client in the same project: package name `app.peachlet`, with the **SHA-1 of the actual signing certificate** used for the installed release. Register Play App Signing's SHA-1 separately if publishing through Google Play. Inspect an existing APK with Android SDK `apksigner verify --print-certs /path/to/app-release.apk`; do not use an unrelated debug certificate.
7. Set `EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID` to that same **web** OAuth client ID in `app/.env` / the EAS environment. Refresh `google-services.json` from Firebase if you also use Firebase and keep its Android client consistent with `app.peachlet`. Never put a service-account private key or OAuth client secret in this file or any `EXPO_PUBLIC_` variable.
8. Rebuild the native application. The native Google Sign-In dependency and its conditional Expo config plugin need a native build; an OTA JavaScript update alone is insufficient. Existing bare/prebuilt build directories must be regenerated or correctly autolinked; do not assume copying JavaScript installs a native module.

Drive backups live in `appDataFolder` and are intentionally hidden in the ordinary Drive file list. Both clients must belong to the same Google Cloud project to share the application's stored backups. Deleting the app's hidden data in Drive can remove backups.

Google Drive on iOS is not enabled in this implementation; configure and test its OAuth client/URL scheme before enabling it. Android uses the community Google Sign-In package's original API; the underlying legacy Android Google Sign-In SDK is deprecated, so migration to Google's AuthorizationClient should be tracked separately.

References: [Drive app-data storage](https://developers.google.com/workspace/drive/api/guides/appdata), [GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [React Native Google Sign-In Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo).

## Dropbox

1. Create an app in the [Dropbox App Console](https://www.dropbox.com/developers/apps): **Scoped access**, **App folder** (not Full Dropbox). Use the same app for web and native so backups are visible from either client.
2. Enable `files.metadata.read`, `files.content.read`, and `files.content.write`, and save the permission changes.
3. Enable public clients / PKCE in the app's OAuth settings. Register these exact redirect URIs:
   - `https://peachlet.app/cloud-callback.html`
   - `peachlet://cloud-backup`
   - For local web testing, the exact dev origin plus `/cloud-callback.html`.
4. Copy the **App key** (not App secret) into `VITE_DROPBOX_APP_KEY` in root `.env.prod`, and `EXPO_PUBLIC_DROPBOX_APP_KEY` in the app's build environment.
5. Rebuild web and native. Add test users / apply for production access in Dropbox as required before offering the integration publicly.

Authorization uses a fresh random state and PKCE S256 verifier for each attempt. Tokens are exchanged directly with Dropbox without an app secret. Native uses an external browser session and validates the custom-scheme callback.

On the web, Dropbox serves its sign-in pages with their own `Cross-Origin-Opener-Policy`, so the browser moves the popup into a separate browsing context group: `window.opener` becomes null in `cloud-callback.html` and the handle held by the app reports the popup as closed while the user is still signing in. The callback therefore relays its URL over `postMessage`, a `BroadcastChannel`, and `localStorage`, and the app accepts whichever channel the browser left intact; callbacks older than five minutes are discarded. Because a closed-looking popup is not a cancellation under that policy, the app waits for the relay (up to five minutes) and offers an explicit **Cancel sign-in** button instead. Every accepted callback is still checked for same-origin postMessage identity, the exact redirect path, and the OAuth state before the code is exchanged, and the popup may stay open after approval since a window whose session history grew past the provider redirects is not always script-closable.

Backups are stored inside the scoped application's folder (`Apps/<your Dropbox app name>`), under unique `peachlet-*.json` filenames. Don't rename files if you want the in-app restore list to find them.

Reference: [Dropbox OAuth guide](https://developers.dropbox.com/oauth-guide).

## Deployment and acceptance checks

When reusing an existing `node_modules` directory, refresh local `file:` dependencies with `bun install --force` in the repository root and in `app/`; the wallet-core package now includes `cloud-backup.js`. Fresh CI installs include it automatically.

The backend's security headers allow Google's specific GIS script/frame and OAuth popups. Deploy that change along with the web build. Provider requests go directly from clients to Google/Dropbox, not through Peachlet's API. The static Dropbox callback must be served at its exact path, not rewritten to the SPA.

After configuration, use a disposable test wallet with no funds:

1. Save to each provider; confirm upload verification succeeds. Cloud files must not contain the phrase/private key in plaintext.
2. Restore on a separate empty browser profile/device using the same cloud account and backup password. Compare the derived address with the original. Test web-to-Android and Android-to-web.
3. Check wrong password, cancelled OAuth, denied scope, offline/expired token, malformed backup, and interrupted restore. Existing local wallets must remain intact.
4. Test native backup with both device authentication and password-protected wallets. Restore with both local protection choices.
5. Run `node --test test/cloud-backup.test.mjs`, web tests, native tests, typechecks, Gleam checks and production builds.

Until credentials and real provider authorization are configured, automated tests validate encryption, provider requests, OAuth state/PKCE, and UI behavior, but cannot prove an actual Google/Dropbox account round trip.
