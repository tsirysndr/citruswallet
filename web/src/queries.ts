import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { rpc, rememberCsrf } from "./api";
import type { Session } from "./types";
import { readBalances } from "./wallet";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const session = await rpc.getSession();
      rememberCsrf(session.csrf);
      return session;
    },
  });
}

/* The name and avatar are decoration: a failed lookup leaves the DID showing. */
export function useProfile(did: string | null | undefined) {
  return useQuery({
    queryKey: ["profile", did],
    enabled: Boolean(did),
    queryFn: async () => {
      try {
        return (await rpc.getProfile()).actor;
      } catch {
        return null;
      }
    },
  });
}

export type PaymentFilters = NonNullable<Parameters<typeof rpc.listPayments>[0]>;

export function usePayments(session: Session | undefined, filters: PaymentFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["payments", session?.did, filters],
    enabled: Boolean(session?.did) && enabled,
    queryFn: ({ signal }) => rpc.listPayments(filters, { signal }),
  });
}

export function useInfinitePayments(session: Session | undefined, filters: PaymentFilters, enabled: boolean) {
  const { page: _page, ...queryFilters } = filters;
  const size = queryFilters.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: ["payments", session?.did, "infinite", queryFilters],
    enabled: Boolean(session?.did) && enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => rpc.listPayments({ ...queryFilters, page: pageParam }, { signal }),
    getNextPageParam: (last, _pages, page) => last.payments.length > 0 && page * size < last.total ? page + 1 : undefined,
  });
}

export function usePayment(id: string | null, session: Session | undefined) {
  return useQuery({
    queryKey: ["payment", id],
    enabled: Boolean(id && session?.did),
    queryFn: async () =>
      (await rpc.getPayment({ id: id! })).payment,
  });
}

export function useInvitation(token: string | null, session: Session | undefined) {
  return useQuery({
    queryKey: ["invitation", token, session?.did],
    enabled: Boolean(token && session?.did),
    queryFn: async () =>
      (await rpc.getInvitation({ token: token! })).payment,
  });
}

export function useBalances(session: Session | undefined) {
  const addresses = (session?.links ?? []).map((link) => link.address).join(",");
  return useQuery({
    queryKey: ["balances", session?.did, session?.network.chainId, addresses],
    enabled: Boolean(session?.did),
    queryFn: () => readBalances(session!),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/* A pick only fills the field: the server still verifies the identity in both
   directions before anything is addressed to it. */
export function useActorSearch(query: string) {
  return useQuery({
    queryKey: ["actors", query],
    enabled: query.length >= 2 && !query.startsWith("did:"),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      try {
        return (await rpc.searchActors({ q: query }, { signal })).actors;
      } catch (error) {
        if (signal.aborted) throw error;
        return [];
      }
    },
  });
}
