import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
const service = 'app.citruswallet.device-vault.v2';
const policy = {
  service,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  authenticationPrompt: { title: 'Unlock Citrus Wallet', subtitle: 'Use your device screen lock or biometrics', cancel: 'Cancel' },
};
export async function deviceUnlockAvailable() {
  // Android 11 added the strong-biometric-or-device-credential combination.
  if (Platform.OS === 'android' && Number(Platform.Version) < 30) return false;
  try { return await Keychain.isPasscodeAuthAvailable(); } catch { return false; }
}
export async function storeDeviceSecret(value: string) {
  if (!await deviceUnlockAvailable()) throw new Error('Set up a device screen lock, or choose a wallet password.');
  const result = await Keychain.setGenericPassword('citrus-wallet', value, {
    ...policy, storage: Keychain.STORAGE_TYPE.AES_GCM,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
    accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
  if (!result) throw new Error('Could not secure the wallet with device unlock.');
}
export async function readDeviceSecret() {
  const result = await Keychain.getGenericPassword(policy);
  if (!result) throw new Error('Device-protected wallet unavailable. Restore your recovery backup.');
  return result.password;
}

export async function removeDeviceSecret() { await Keychain.resetGenericPassword({ service }); }
