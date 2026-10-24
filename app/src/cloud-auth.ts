import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { driveScope, dropboxAuthorization, exchangeDropboxCode, type CloudProvider } from '@peachlet/wallet-core';
const googleId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID || '';
const dropboxId = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY || '';
export const cloudConfigured = (provider: CloudProvider) => Boolean(provider === 'google' ? googleId && Platform.OS === 'android' : dropboxId);
export async function connectCloud(provider: CloudProvider): Promise<string> {
  if (!cloudConfigured(provider)) throw new Error(`${provider === 'google' ? 'Google Drive' : 'Dropbox'} backup is not configured for this build.`);
  if (provider === 'google') {
    const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: googleId, scopes: [driveScope], offlineAccess: false });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Allow choosing a different cloud account for recovery.
    await GoogleSignin.signOut();
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) throw new Error('Google sign-in was cancelled.');
    if (!result.data.scopes.includes(driveScope)) throw new Error('Google Drive permission was not granted.');
    return (await GoogleSignin.getTokens()).accessToken;
  }
  const auth = dropboxAuthorization(dropboxId, 'peachlet://cloud-backup');
  const result = await WebBrowser.openAuthSessionAsync(auth.url, auth.redirectUri);
  if (result.type !== 'success') throw new Error('Dropbox sign-in was cancelled.');
  return exchangeDropboxCode(auth, result.url);
}
