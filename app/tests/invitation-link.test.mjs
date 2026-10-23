import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invitationToken } from '../src/invitation-link.ts';
const token = 'a'.repeat(64);
test('accepts verified invitation URLs, legacy links and native fallback links', () => {
  for (const base of ['https://citruswallet.app/invite', 'https://citruswallet.app/', 'citruswallet://invite'])
    assert.equal(invitationToken(`${base}#invite=${token}`), token);
});
test('rejects foreign domains, malformed tokens, query secrets and OAuth callbacks', () => {
  for (const url of [`https://evil.test/invite#invite=${token}`, `https://citruswallet.app.evil.test/invite#invite=${token}`,
    `http://citruswallet.app/invite#invite=${token}`, `https://citruswallet.app/invite?invite=${token}`,
    `citruswallet://auth#invite=${token}`, `citruswallet://invite#invite=${token}&invite=${token}`,
    'citruswallet://invite#invite=bad', 'not a url']) assert.equal(invitationToken(url), null);
});
