import { useQuery } from "@tanstack/react-query";
import { request } from "./api";
export function useEthPrice(enabled: boolean) {
  return useQuery({
    queryKey: ["eth-usd"],
    enabled,
    queryFn: () =>
      request<{ usd: string; updatedAt: number; source: string }>(
        "getEthPrice",
      ),
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
}
