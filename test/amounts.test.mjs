import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, erc20Abi } from 'viem';
import { parseAmount, formatAmount, formatBalance, editAmount, sumAtomic, fiatValue, expectedTransfer } from '../app/packages/amounts/index.js';
test('amounts preserve exact units across asset precisions and the uint256 boundary', () => {
  for (const decimals of [0, 6, 8, 18, 255]) {
    for (const units of ['1', '123456789012345678901234567890', (2n ** 256n - 1n).toString()])
      assert.equal(parseAmount(formatAmount(units, decimals), decimals), units);
  }
  assert.equal(parseAmount('1,234567', 6), '1234567');
  for (const input of ['0', '-1', 'NaN', 'Infinity', '1e6', '0xff', '01', '1,000.00', '1.0000001']) assert.throws(() => parseAmount(input, 6), input);
  assert.throws(() => parseAmount((2n ** 256n).toString(), 0));
  assert.throws(() => parseAmount('1', 256));
  assert.equal(formatBalance('1234567890123456789012', 18), '1,234.567890123456789012');
  assert.equal(sumAtomic(['9007199254740993', '1']), '9007199254740994');
  assert.equal(fiatValue('1000001', 6, '1.005', 2), '1.01');
  assert.equal(editAmount('1', '.', 0), '1');
  assert.equal(editAmount('0.' + '0'.repeat(254), '1', 255), '0.' + '0'.repeat(254) + '1');
  assert.equal(editAmount('1.123456', '7', 6), '1.123456');
});
const asset = { id: 'eip155:1/erc20:0x4444444444444444444444444444444444444444', chain: 'eip155:1', chainId: 1, kind: 'erc20', contractAddress: '0x4444444444444444444444444444444444444444', decimals: 6 };
const payment = { address: '0x2222222222222222222222222222222222222222', chainId: 1, amount: '1.234567', amountAtomic: '1234567', amountWei: '1234567', asset: 'USDC', assetId: asset.id, assetDetails: asset };
test('reviewed ERC-20 transfer matches the standard ABI and rejects identity/amount tampering', () => {
  const tx = expectedTransfer(payment);
  assert.equal(tx.value, '0'); assert.equal(tx.to, asset.contractAddress);
  assert.equal(tx.data, encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [payment.address, 1234567n] }));
  for (const changes of [{ chainId: 2 }, { amount: '2' }, { amountAtomic: '0' }, { assetId: 'ETH' }, { assetDetails: undefined }, { assetDetails: { ...asset, decimals: 18 } }, { assetDetails: { ...asset, contractAddress: payment.address } }])
    assert.throws(() => expectedTransfer({ ...payment, ...changes }));
});
test('legacy ETH review remains a native transfer, without rounding or calldata', () => {
  const tx = expectedTransfer({ ...payment, asset: 'ETH', amount: '1', amountWei: '1000000000000000000', amountAtomic: undefined, assetDetails: undefined });
  assert.deepEqual(tx, { to: payment.address, value: '1000000000000000000', data: '0x' });
});

test('portfolio totals include native ETH and tokens once, rounding only the final sum', async () => {
  const { portfolioUsd, formatUsd } = await import('../app/packages/amounts/index.js');
  const contract = '0x4444444444444444444444444444444444444444';
  const row = { address: '0xabc', balanceAtomic: '1000000', usdPrice: '1.004', asset: { id: `eip155:1/erc20:${contract}`, chainId: 1, kind: 'erc20', contractAddress: contract, decimals: 6 } };
  assert.deepEqual(portfolioUsd('1000000000000000000', '2000.004', [row, row], 1), { usd: '2001.01', missing: 0 });
  assert.equal(formatUsd('12345678901234567890.12'), '$12,345,678,901,234,567,890.12');
  assert.deepEqual(portfolioUsd('0', undefined, [], 1), { usd: '0.00', missing: 0 });
  assert.deepEqual(portfolioUsd('1000000000000000000', '2000', [ { ...row, usdPrice: undefined } ], 1), { usd: '2000.00', missing: 1 });
  assert.deepEqual(portfolioUsd('1000000000000000000', undefined, [], 1), { usd: null, missing: 1 });
  assert.equal(portfolioUsd('1000000000000000000', '2000', [], 6343).usd, '2000.00');
  assert.equal(portfolioUsd('0', '2000', [{ ...row, asset: { ...row.asset, chainId: 4326 } }], 1).missing, 1);
});


test('USD entry converts to exact wei and rounds down without floating point', async () => {
  const { usdToEth } = await import('../app/packages/amounts/index.js');
  const at = 1700000000000;
  assert.deepEqual(usdToEth('25,00', { usd: '2500', updatedAt: at }, at), {
    usd: '25.00', eth: '0.01', amountWei: '10000000000000000', rate: '2500', updatedAt: at,
  });
  assert.equal(usdToEth('1', { usd: '3', updatedAt: at }, at).amountWei, '333333333333333333');
  assert.equal(usdToEth('9007199254740993.01', { usd: '1', updatedAt: at }, at).amountWei, '9007199254740993010000000000000000');
});
test('USD entry rejects expired rates, invalid amounts and sub-wei transfers', async () => {
  const { usdToEth } = await import('../app/packages/amounts/index.js');
  const at = 1700000000000;
  for (const value of ['0', '-1', '1.001', '1e5', '1,000.00']) assert.throws(() => usdToEth(value, { usd: '2500', updatedAt: at }, at));
  for (const price of [null, { usd: '0', updatedAt: at }, { usd: '-1', updatedAt: at }, { usd: 'NaN', updatedAt: at }, { usd: '2500', updatedAt: at - 300000 }, { usd: '2500', updatedAt: at + 31000 }]) assert.throws(() => usdToEth('25', price, at));
  assert.throws(() => usdToEth('0.01', { usd: '100000000000000000000', updatedAt: at }, at));
});
