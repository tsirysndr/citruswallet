import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCloudBackup, restoreCloudBackup, parseCloudBackup, uploadCloudBackup, listCloudBackups, downloadCloudBackup, dropboxAuthorization, exchangeDropboxCode } from '../app/packages/wallet-core/index.js';
const secret = { kind: 'mnemonic', value: 'test test test test test test test test test test test junk' };
const password = 'backup password for tests only';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
let backup;
test('portable authenticated backup round trips without a device key and rejects wrong passwords and tampering', async () => {
  backup = await createCloudBackup(secret, password);
  assert.ok(!backup.includes(secret.value));
  assert.deepEqual(await restoreCloudBackup(backup, password), secret);
  await assert.rejects(restoreCloudBackup(backup, 'wrong backup password'), /Could not restore/);
  const edited = JSON.parse(backup); edited.envelope.ciphertext = (edited.envelope.ciphertext.startsWith('00') ? '01' : '00') + edited.envelope.ciphertext.slice(2);
  await assert.rejects(restoreCloudBackup(JSON.stringify(edited), password), /Could not restore/);
  await assert.rejects(createCloudBackup(secret, 'short'), /12 characters/);
  assert.throws(() => parseCloudBackup('x'.repeat(16385)), /not a supported/);
  assert.throws(() => parseCloudBackup(JSON.stringify({ ...JSON.parse(backup), version: 2 })), /not a supported/);
});
test('Google stores only encrypted data in appDataFolder and verifies the downloaded bytes', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? json({ id: 'drive-file' }) : new Response(backup); };
  await uploadCloudBackup('google', 'test-token', backup);
  assert.equal(calls.length, 2);
  assert.match(calls[0].options.body, /appDataFolder/);
  assert.ok(!calls[0].options.body.includes(secret.value));
  assert.match(calls[1].url, /drive-file\?alt=media/);
});
test('Dropbox creates a distinct backup without overwriting and verifies it', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? json({ id: 'id:backup' }) : new Response(backup); };
  await uploadCloudBackup('dropbox', 'test-token', backup);
  const args = JSON.parse(calls[0].options.headers['Dropbox-API-Arg']);
  assert.equal(args.mode, 'add'); assert.equal(args.strict_conflict, true);
  assert.equal(calls[0].options.body, backup);
  assert.equal(calls[1].url, 'https://content.dropboxapi.com/2/files/download');
});
test('never reports success when upload verification differs', async () => {
  let n = 0;
  globalThis.fetch = async () => ++n === 1 ? json({ id: 'drive-file' }) : new Response(backup + ' ');
  await assert.rejects(uploadCloudBackup('google', 'test-token', backup), /verify/);
});
test('Dropbox PKCE is S256 and rejects mismatched state or callback before token exchange', async () => {
  const auth = dropboxAuthorization('test-client', 'peachlet://cloud-backup');
  const url = new URL(auth.url);
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(auth.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('token_access_type'), 'online');
  globalThis.fetch = async () => { throw new Error('must not fetch'); };
  await assert.rejects(exchangeDropboxCode(auth, 'peachlet://cloud-backup?code=x&state=wrong'), /did not match/);
  await assert.rejects(exchangeDropboxCode(auth, `peachlet://other?code=x&state=${auth.state}`), /did not match/);
  await assert.rejects(exchangeDropboxCode(auth, `peachlet://cloud-backup?code=x&state=${auth.state}&state=${auth.state}`), /did not match/);
  globalThis.fetch = async (url, options) => { assert.equal(url, 'https://api.dropboxapi.com/oauth2/token'); assert.equal(new URLSearchParams(options.body).get('code_verifier'), auth.verifier); return json({ access_token: 'test-token' }); };
  assert.equal(await exchangeDropboxCode(auth, `peachlet://cloud-backup?code=x&state=${auth.state}`), 'test-token');
});
test('paginates Drive backups and keeps requests confined to the provider', async () => {
  let n = 0;
  globalThis.fetch = async url => { assert.match(url, /^https:\/\/www.googleapis.com\/drive\/v3\/files\?/); return ++n === 1 ? json({ files: [{ id: 'one', name: 'peachlet-one.json', modifiedTime: '2026-01-01' }], nextPageToken: 'cursor' }) : json({ files: [{ id: 'two', name: 'peachlet-two.json', modifiedTime: '2026-02-01' }] }); };
  const result = await listCloudBackups('google', 'test-token');
  assert.equal(n, 2); assert.deepEqual(result.map(file => file.id), ['two', 'one']);
  await assert.rejects(downloadCloudBackup('google', 'test-token', 'https://attacker.test/'), /Invalid backup/);
});
test('handles expired permission and malformed downloads', async () => {
  globalThis.fetch = async () => new Response('', { status: 401 });
  await assert.rejects(listCloudBackups('google', 'test-token'), /expired/);
  globalThis.fetch = async () => new Response('{"privateKey":"untrusted"}');
  await assert.rejects(downloadCloudBackup('dropbox', 'test-token', 'id:test'), /not a supported/);
});
