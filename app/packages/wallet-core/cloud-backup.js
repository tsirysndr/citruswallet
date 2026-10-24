import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { encryptSecret, decryptSecret, validateEnvelope, validatePassword, randomBytes } from './index.js';

export const driveScope = 'https://www.googleapis.com/auth/drive.appdata';
const maxBytes = 16_384;
export async function createCloudBackup(secret, password) {
  validatePassword(password);
  return JSON.stringify({ format: 'app.peachlet.wallet-backup', version: 1, createdAt: new Date().toISOString(), envelope: await encryptSecret(secret, password) });
}
export function parseCloudBackup(text) {
  if (typeof text !== 'string' || text.length > maxBytes) throw new Error('This is not a supported Peachlet backup.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This backup is damaged or invalid.'); }
  if (data?.format !== 'app.peachlet.wallet-backup' || data.version !== 1) throw new Error('This is not a supported Peachlet backup.');
  validateEnvelope(data.envelope);
  return data;
}
export async function restoreCloudBackup(text, password) {
  validatePassword(password);
  try { return await decryptSecret(parseCloudBackup(text).envelope, password); }
  catch { throw new Error('Could not restore this backup. Check the backup password and file.'); }
}
function base64url(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 6) { bits -= 6; result += alphabet[(value >>> bits) & 63]; } }
  if (bits) result += alphabet[(value << (6 - bits)) & 63];
  return result;
}
export function dropboxAuthorization(clientId, redirectUri) {
  if (!clientId) throw new Error('Dropbox backup is not configured yet.');
  const verifier = bytesToHex(randomBytes(32)), state = bytesToHex(randomBytes(32));
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', token_access_type: 'online', code_challenge_method: 'S256', code_challenge: base64url(sha256(utf8ToBytes(verifier))), state, scope: 'files.metadata.read files.content.read files.content.write' });
  return { url: `https://www.dropbox.com/oauth2/authorize?${params}`, verifier, state, redirectUri, clientId };
}
// Fixed provider endpoints only; credentials are never sent to a backup-supplied URL.
async function responseText(url, options, limit = maxBytes) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error(response.status === 401 ? 'Cloud access expired. Connect again.' : response.status === 429 ? 'Cloud storage is busy. Try again shortly.' : 'Cloud storage could not complete the request. Try again.');
        if (Number(response.headers.get('content-length')) > limit) throw new Error('Cloud response is too large.');
        const text = await response.text();
        if (text.length > limit) throw new Error('Cloud response is too large.');
        return text;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Cloud request timed out. Connect again and retry.')); }, 30_000); }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function exchangeDropboxCode(auth, callbackUrl) {
  const callback = new URL(callbackUrl), expected = new URL(auth.redirectUri);
  if (callback.origin !== expected.origin || callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== auth.state) throw new Error('Cloud sign-in did not match this request. Try again.');
  const code = callback.searchParams.get('code');
  if (callback.searchParams.has('error') || !code || callback.searchParams.getAll('code').length !== 1) throw new Error('Cloud sign-in was cancelled.');
  const data = JSON.parse(await responseText('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: auth.verifier, client_id: auth.clientId, redirect_uri: auth.redirectUri }).toString() }));
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Cloud sign-in failed.');
  return data.access_token;
}
function headers(token) { if (!token) throw new Error('Connect cloud storage first.'); return { Authorization: `Bearer ${token}` }; }
function provider(value) { if (!['google', 'dropbox'].includes(value)) throw new Error('Unsupported cloud provider.'); }
export async function listCloudBackups(service, token) {
  provider(service);
  const files = []; let cursor;
  for (let page = 0; page < 20; page++) {
    let data;
    if (service === 'google') {
      const params = new URLSearchParams({ spaces: 'appDataFolder', q: "trashed = false and name contains 'peachlet-'", fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '100', orderBy: 'modifiedTime desc', ...(cursor ? { pageToken: cursor } : {}) });
      data = JSON.parse(await responseText(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: headers(token) }, 262144));
      files.push(...(data.files || []).map(file => ({ id: file.id, name: file.name, modifiedAt: file.modifiedTime })));
      cursor = data.nextPageToken;
    } else {
      data = JSON.parse(await responseText(`https://api.dropboxapi.com/2/files/list_folder${cursor ? '/continue' : ''}`, { method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' }, body: JSON.stringify(cursor ? { cursor } : { path: '', recursive: false, limit: 100 }) }, 262144));
      files.push(...(data.entries || []).filter(file => file['.tag'] === 'file' && /^peachlet-.*\.json$/.test(file.name)).map(file => ({ id: file.id, name: file.name, modifiedAt: file.server_modified })));
      cursor = data.has_more ? data.cursor : undefined;
    }
    if (!cursor) return files.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
  }
  throw new Error('Too many cloud files to list. Please organize the Peachlet backup folder.');
}
export async function downloadCloudBackup(service, token, id) {
  provider(service);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_:\-]{1,256}$/.test(id)) throw new Error('Invalid backup identifier.');
  const text = service === 'google'
    ? await responseText(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: headers(token) })
    : await responseText('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { ...headers(token), 'Dropbox-API-Arg': JSON.stringify({ path: id }) } });
  parseCloudBackup(text);
  return text;
}
export async function uploadCloudBackup(service, token, text) {
  provider(service); parseCloudBackup(text);
  const name = `peachlet-${new Date().toISOString().replace(/[:.]/g, '-')}-${bytesToHex(randomBytes(8))}.json`;
  let result;
  if (service === 'google') {
    const boundary = `peachlet_${bytesToHex(randomBytes(16))}`;
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    result = JSON.parse(await responseText('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { ...headers(token), 'Content-Type': `multipart/related; boundary=${boundary}` }, body }));
  } else {
    result = JSON.parse(await responseText('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: `/${name}`, mode: 'add', autorename: false, mute: true, strict_conflict: true }) }, body: text }));
  }
  // A successful upload is not enough: check the stored bytes before reporting success.
  if (await downloadCloudBackup(service, token, result.id) !== text) throw new Error('Could not verify the saved backup. Keep your recovery information and retry.');
  return { id: result.id, name, modifiedAt: new Date().toISOString() };
}
