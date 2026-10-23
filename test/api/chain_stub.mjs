import { erc20Abi, encodeFunctionData, encodeEventTopics, encodeAbiParameters } from 'viem';
const contract = '0x4444444444444444444444444444444444444444';
// Test-only viem boundary. No transport, network, keys, or transaction broadcasting.
export function client() {
  return {
    mode: 'confirmed', calls: [], token: false,
    async readContract({ functionName }) {
      if (functionName === 'decimals') return this.mode === 'changed-decimals' ? 18 : 6;
      if (functionName === 'symbol') return 'USDC';
      if (functionName === 'name') return 'USD Coin';
      if (functionName === 'balanceOf') return this.mode === 'insufficient' ? 1n : 1000000000n;
      throw new Error('Unexpected contract call');
    },
    async call() {
      if (this.mode === 'simulation-revert') throw new Error('revert');
      return { data: '0x' + (this.mode === 'simulation-false' ? '0' : '1').padStart(64, '0') };
    },
    async getChainId() {
      this.calls.push('getChainId');
      if (this.mode === 'offline') throw new Error('RPC offline');
      return this.mode === 'wrong-chain' ? 31337 : 1;
    },
    async getTransactionCount({ blockTag }) {
      if (blockTag !== 'pending') throw new Error('Expected pending nonce');
      this.calls.push('getTransactionCount');
      return this.mode === 'used-nonce' ? 8 : 7;
    },
    async getTransaction() {
      this.calls.push('getTransaction');
      if (this.mode === 'missing-transaction') throw Object.assign(new Error('Not found'), { name: 'TransactionNotFoundError' });
      const tx = {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: 1000000000000000000n, input: '0x', nonce: 7, chainId: 1,
      };
      const overrides = {
        'wrong-sender': { from: '0x3333333333333333333333333333333333333333' },
        'wrong-recipient': { to: '0x3333333333333333333333333333333333333333' },
        'contract-creation': { to: null },
        'wrong-value': { value: 1n },
        'wrong-data': { input: '0x1234' },
        'wrong-nonce': { nonce: 8 },
        'wrong-transaction-chain': { chainId: 31337 },
      };
      if (this.token) Object.assign(tx, { to: contract, value: 0n,
        input: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: ['0x2222222222222222222222222222222222222222', 1000000n] }) });
      return { ...tx, ...overrides[this.mode] };
    },
    async getTransactionReceipt() {
      this.calls.push('getTransactionReceipt');
      if (this.mode === 'pending') throw Object.assign(new Error('Not found'), { name: 'TransactionReceiptNotFoundError' });
      const log = { address: this.mode === 'log-contract' ? '0x5555555555555555555555555555555555555555' : contract,
        topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: {
          from: this.mode === 'log-sender' ? contract : '0x1111111111111111111111111111111111111111',
          to: this.mode === 'log-recipient' ? contract : '0x2222222222222222222222222222222222222222' } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [this.mode === 'log-amount' ? 999999n : 1000000n]) };
      return { status: this.mode === 'reverted' ? 'reverted' : 'success', blockNumber: 100n,
        logs: !this.token || this.mode === 'log-missing' ? [] : this.mode === 'log-duplicate' ? [log, log] : [{ topics: [], data: "0x", address: contract }, log] };
    },
    async getBlockNumber() { this.calls.push('getBlockNumber'); return this.mode === 'confirming' ? 110n : 111n; },
  };
}
export function setMode(client, mode) { client.mode = mode; if (mode === 'erc20') client.token = true; }
export function callCount(client) { return client.calls.length; }
