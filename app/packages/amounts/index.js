import BigNumber from 'bignumber.js';
// Isolated configuration: callers cannot change payment rounding globally.
const Decimal = BigNumber.clone({ DECIMAL_PLACES: 100, ROUNDING_MODE: BigNumber.ROUND_DOWN });
const MAX_DIGITS = 78;
const UINT256_MAX = new Decimal('115792089237316195423570985008687907853269984665640564039457584007913129639935');
function precision(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Invalid asset decimals.');
}
function atomic(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || value.length > MAX_DIGITS) throw new Error('Invalid atomic amount.');
  const amount = new Decimal(value);
  if (amount.gt(UINT256_MAX)) throw new Error('Amount exceeds the supported range.');
  return amount;
}
export function normalizeInput(value) {
  if (typeof value !== 'string' || value.length > 340) throw new Error('Invalid amount.');
  const normalized = value.trim().replace(',', '.');
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) throw new Error('Enter a decimal amount without grouping separators.');
  return normalized;
}
export function parseAmount(input, decimals) {
  precision(decimals);
  const normalized = normalizeInput(input);
  if ((normalized.split('.')[1]?.length ?? 0) > decimals) throw new Error(`This asset supports at most ${decimals} decimal places.`);
  const value = new Decimal(normalized).shiftedBy(decimals);
  if (!value.isFinite() || !value.isInteger() || !value.gt(0) || value.gt(UINT256_MAX)) throw new Error('Enter a positive amount within the supported range.');
  return value.toFixed(0);
}
export function formatAmount(value, decimals) {
  precision(decimals);
  return atomic(value).shiftedBy(-decimals).toFixed();
}
export function formatBalance(value, decimals, places = decimals) {
  precision(decimals); precision(places);
  const exact = atomic(value).shiftedBy(-decimals);
  const shown = exact.toFixed(Math.min(places, decimals), Decimal.ROUND_DOWN);
  const [whole, fraction = ''] = shown.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (trimmed ? `.${trimmed}` : '');
}
export function editAmount(current, key, decimals = 18) {
  precision(decimals);
  if (key === 'backspace') return current.slice(0, -1) || '0';
  if (key === ',' || key === '.') return decimals === 0 || current.includes('.') ? current : `${current}.`;
  if (!/^\d$/.test(key)) return current;
  const fraction = current.split('.')[1];
  if (fraction !== undefined && fraction.length >= decimals) return current;
  if (current.length >= 340) return current;
  return current === '0' ? key : current + key;
}
export function sumAtomic(values) {
  return values.reduce((total, value) => total.plus(atomic(value)), new Decimal('0')).toFixed(0);
}
// Conversion is for display only; never feed a rounded fiat value back into a transfer.
export function fiatValue(value, decimals, price, places = 2) {
  precision(decimals); precision(places);
  const rate = new Decimal(normalizeInput(price));
  return atomic(value).shiftedBy(-decimals).times(rate).toFixed(places, Decimal.ROUND_HALF_UP);
}

// Verify the reviewed asset identity and construct the exact wallet request locally.
export function expectedTransfer(payment) {
  const address = /^0x[0-9a-fA-F]{40}$/;
  if (!address.test(payment.address ?? '')) throw new Error('Invalid recipient address.');
  const asset = payment.assetDetails;
  const amount = payment.amountAtomic ?? payment.amountWei;
  atomic(amount);
  if (BigInt(amount) <= 0n) throw new Error('Invalid payment amount.');
  if (!asset) {
    if (payment.asset !== 'ETH') throw new Error('Missing asset metadata.');
    if (parseAmount(payment.amount, 18) !== amount) throw new Error('Payment amount changed.');
    return { to: payment.address, value: amount, data: '0x' };
  }
  if (asset.chainId !== payment.chainId || asset.chain !== `eip155:${payment.chainId}` ||
      payment.assetId !== asset.id || parseAmount(payment.amount, asset.decimals) !== amount)
    throw new Error('Payment asset changed.');
  if (asset.kind === 'native' && asset.contractAddress === null && asset.decimals === 18 &&
      asset.id === `eip155:${payment.chainId}/slip44:60`)
    return { to: payment.address, value: amount, data: '0x' };
  if (asset.kind !== 'erc20' || !address.test(asset.contractAddress ?? '') ||
      asset.id !== `eip155:${payment.chainId}/erc20:${asset.contractAddress.toLowerCase()}`)
    throw new Error('Invalid token contract.');
  return {
    to: asset.contractAddress, value: '0',
    data: '0xa9059cbb' + payment.address.slice(2).toLowerCase().padStart(64, '0') + BigInt(amount).toString(16).padStart(64, '0'),
  };
}

// Sum full-precision valuations, then round once for display. Never value by ticker.
export function portfolioUsd(nativeAtomic, ethPrice, assets, chainId) {
  if (![1, 4326, 6343].includes(chainId)) return { usd: null, missing: 0 };
  let total = new Decimal(0), priced = false, missing = 0;
  const add = (value, decimals, price) => {
    try {
      const quantity = atomic(value); precision(decimals);
      if (quantity.isZero()) { priced = true; return; }
      if (typeof price !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(price) || !new Decimal(price).gt(0)) { missing++; return; }
      total = total.plus(quantity.shiftedBy(-decimals).times(price)); priced = true;
    } catch { missing++; }
  };
  if (nativeAtomic !== null) add(nativeAtomic, 18, ethPrice);
  let nativeFound = false;
  const seen = new Set();
  for (const row of assets) {
    const asset = row.asset;
    const key = `${row.address.toLowerCase()}:${asset.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (asset.kind === 'native') {
      if (nativeAtomic !== null) continue; // Provider total already includes these wallets.
      if (asset.chainId === chainId && asset.id === `eip155:${chainId}/slip44:60` && asset.decimals === 18) {
        nativeFound = true; add(row.balanceAtomic, 18, ethPrice);
      } else missing++;
      continue;
    }
    if (asset.chainId !== chainId || asset.id !== `eip155:${chainId}/erc20:${asset.contractAddress?.toLowerCase()}`) { missing++; continue; }
    add(row.balanceAtomic, asset.decimals, row.usdPrice);
  }
  if (nativeAtomic === null && !nativeFound) missing++;
  return { usd: priced ? total.toFixed(2, Decimal.ROUND_HALF_UP) : null, missing };
}
export function formatUsd(value) {
  if (!/^\d+\.\d{2}$/.test(value)) throw new Error('Invalid USD value');
  const [whole, cents] = value.split('.');
  return '$' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + cents;
}

// Convert a user-entered USD amount directly to wei without floating-point math.
// Round down by at most one wei; never exceed the entered dollar amount.
export function usdToEth(input, price, now = Date.now()) {
  const cents = parseAmount(input, 2);
  if (!price || !Number.isSafeInteger(price.updatedAt) || !Number.isFinite(now) ||
      price.updatedAt > now + 30_000 || now - price.updatedAt >= 300_000)
    throw new Error('The ETH price is unavailable or expired. Refresh the rate to continue.');
  const rate = new Decimal(normalizeInput(price.usd));
  if (!rate.isFinite() || !rate.gt(0)) throw new Error('The ETH price is unavailable. Refresh the rate to continue.');
  const wei = new Decimal(cents).shiftedBy(16).dividedBy(rate).integerValue(Decimal.ROUND_DOWN).toFixed(0);
  const eth = formatAmount(wei, 18);
  parseAmount(eth, 18); // Reject sub-wei and out-of-range payments.
  return { usd: new Decimal(cents).shiftedBy(-2).toFixed(2), eth, amountWei: wei, rate: rate.toFixed(), updatedAt: price.updatedAt };
}
