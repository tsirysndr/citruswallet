import { useQuery } from '@tanstack/react-query';
import { rpc } from './api';
export function useEthPrice(enabled: boolean) {
  return useQuery({ queryKey: ['eth-usd'], enabled, queryFn: () => rpc.getEthPrice(), staleTime: 60_000, refetchInterval: enabled ? 60_000 : false, retry: false });
}
