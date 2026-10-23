// Test-only viem boundary. No transport, network, keys, or transaction broadcasting.
export function client() {
  return {
    mode: 'confirmed', calls: [],
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
      return { ...tx, ...overrides[this.mode] };
    },
    async getTransactionReceipt() {
      this.calls.push('getTransactionReceipt');
      if (this.mode === 'pending') throw Object.assign(new Error('Not found'), { name: 'TransactionReceiptNotFoundError' });
      return { status: this.mode === 'reverted' ? 'reverted' : 'success', blockNumber: 100n };
    },
    async getBlockNumber() { this.calls.push('getBlockNumber'); return this.mode === 'confirming' ? 110n : 111n; },
  };
}
export function setMode(client, mode) { client.mode = mode; }
export function callCount(client) { return client.calls.length; }
