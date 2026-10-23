// ABI/SDK boundary only. Asset selection, policy and receipt checks live in Gleam.
import { erc20Abi, encodeFunctionData, decodeEventLog } from 'viem';
export const erc20ABI = () => erc20Abi;
export const encodeTransfer = (recipient, atomic) => encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, BigInt(atomic)] });
export function decodeTransfer(log) {
  try { const event = decodeEventLog({ abi: erc20Abi, eventName: 'Transfer', data: log.data, topics: log.topics, strict: true });
    return { contract: log.address, from: event.args.from, to: event.args.to, amount: event.args.value.toString() };
  } catch { return {}; }
}
