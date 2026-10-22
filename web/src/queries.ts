import { useQuery } from "@tanstack/react-query";
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

export function usePayments(session: Session | undefined) {
  return useQuery({
    queryKey: ["payments", session?.did],
    enabled: Boolean(session?.did),
    queryFn: async () => (await rpc.listPayments()).payments,
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
