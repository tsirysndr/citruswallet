import { storeDeviceSecret, readDeviceSecret } from '../src/device-vault';
import * as Keychain from 'react-native-keychain';
jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'device-or-biometrics' },
  STORAGE_TYPE: { AES_GCM: 'auth-gcm' }, SECURITY_LEVEL: { SECURE_SOFTWARE: 'software' },
  ACCESSIBLE: { WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'passcode-device-only' },
  isPasscodeAuthAvailable: jest.fn(async () => true), setGenericPassword: jest.fn(async () => ({})), getGenericPassword: jest.fn(async () => false), resetGenericPassword: jest.fn(),
}));
test('requires an authentication-gated keystore cipher and device-only access', async () => {
  await storeDeviceSecret('test-secret');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('citrus-wallet', 'test-secret', expect.objectContaining({ accessControl: 'device-or-biometrics', storage: 'auth-gcm', accessible: 'passcode-device-only' }));
});
test('does not fall back to unprotected storage when no screen lock exists', async () => {
  Keychain.setGenericPassword.mockClear(); Keychain.isPasscodeAuthAvailable.mockResolvedValueOnce(false);
  await expect(storeDeviceSecret('test-secret')).rejects.toThrow('screen lock');
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  await expect(readDeviceSecret()).rejects.toThrow('unavailable');
});
