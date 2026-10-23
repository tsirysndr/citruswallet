import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountFromSecret, createRecoveryPhrase, normalizeSecret, encryptSecret, decryptSecret, validateEnvelope, validatePassword } from '../app/packages/wallet-core/index.js';
// Published BIP-39 test vector. Never funded or used outside unit tests.
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const secret = normalizeSecret(phrase, 'mnemonic');
test('BIP-39 derivation is compatible with Ethereum wallets', () => {
  assert.equal(accountFromSecret(secret).address, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  assert.equal(normalizeSecret('  '+phrase.toUpperCase()+'  ', 'mnemonic').value, phrase);
  const generated = createRecoveryPhrase();
  assert.equal(normalizeSecret(generated, 'mnemonic').value, generated);
  assert.equal(generated.split(' ').length, 12);
});
test('rejects invalid seed checksum, invalid private scalars, and short passwords', () => {
  assert.throws(() => normalizeSecret('abandon '.repeat(12), 'mnemonic'));
  assert.throws(() => normalizeSecret('00'.repeat(32), 'privateKey'));
  assert.throws(() => normalizeSecret('ff'.repeat(32), 'privateKey'));
  assert.throws(() => validatePassword('123456'));
});
test('encrypted vault round-trips without storing the secret; wrong keys and tampering fail closed', async () => {
  const encrypted = await encryptSecret(secret, 'a long test password');
  assert.ok(!JSON.stringify(encrypted).includes('abandon'));
  assert.deepEqual(await decryptSecret(encrypted, 'a long test password'), secret);
  await assert.rejects(decryptSecret(encrypted, 'wrong password'));
  const corrupted = { ...encrypted, ciphertext: (encrypted.ciphertext[0] === '0' ? '1' : '0') + encrypted.ciphertext.slice(1) };
  await assert.rejects(decryptSecret(corrupted, 'a long test password'));
  assert.throws(() => validateEnvelope({ ...encrypted, iterations: 1 }));
  assert.throws(() => validateEnvelope({ ...encrypted, iterations: 999999999 }));
  assert.throws(() => validateEnvelope({ ...encrypted, nonce: '' }));
  const second = await encryptSecret(secret, 'a long test password');
  assert.notEqual(second.salt, encrypted.salt);
  assert.notEqual(second.nonce, encrypted.nonce);
  assert.notEqual(second.ciphertext, encrypted.ciphertext);
});

test('recovery confirmation selects exactly three distinct positions with unique shuffled options', async () => {
  const { recoveryChallenge } = await import('../app/packages/wallet-core/index.js');
  for (let run = 0; run < 20; run++) {
    const prompts = recoveryChallenge(phrase);
    assert.equal(prompts.length, 3);
    assert.equal(new Set(prompts.map(item => item.index)).size, 3);
    prompts.forEach((prompt, section) => {
      assert.ok(prompt.index >= section * 4 && prompt.index < (section + 1) * 4);
      assert.equal(new Set(prompt.choices).size, 4);
      assert.ok(prompt.choices.includes(phrase.split(' ')[prompt.index]));
    });
  }
});
