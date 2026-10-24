import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeQuoteParameters } from '../app/packages/wallet-core/index.js';
const tx = { from: '0x1111111111111111111111111111111111111111', to: '0x2222222222222222222222222222222222222222', value: '0x123', data: '0x', nonce: '0x7', chainId: '0x10e6' };
const now = 1000000;
const quote = { ...tx, chainId: 4326, value: '291', nonce: 7, gasLimit: '63349', maxFeePerGas: '123456789012345678', maxPriorityFeePerGas: '0', maxFeeWei: (63349n * 123456789012345678n).toString(), expiresAt: now + 60000 };
test('fee quotes preserve MegaETH gas and integer precision without changing transaction fields', () => {
  assert.deepEqual(feeQuoteParameters(quote, tx, 4326, now), { gas: 63349n, maxFeePerGas: 123456789012345678n, maxPriorityFeePerGas: 0n, type: 'eip1559' });
});
test('fee quote validation rejects wrong chains, changed transfers, expired quotes and inconsistent fees', () => {
  for (const change of [{ chainId: 1 }, { from: tx.to }, { to: tx.from }, { value: '292' }, { data: '0xab' }, { nonce: 8 }, { expiresAt: now }, { expiresAt: now + 120001 }, { gasLimit: '0' }, { gasLimit: '-1' }, { gasLimit: '1e9' }, { maxFeeWei: '1' }, { maxPriorityFeePerGas: '123456789012345679' }])
    assert.throws(() => feeQuoteParameters({ ...quote, ...change }, tx, 4326, now));
  assert.throws(() => feeQuoteParameters(quote, { ...tx, chainId: '0x1' }, 4326, now));
});
