import { useQuery } from "@tanstack/react-query";
import { api, rememberCsrf } from "./api";
import type { Actor, Payment, Session } from "./types";
import { readBalances } from "./wallet";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const session = await api<Session>("/api/session");
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
        const response = await fetch("/api/profile");
        if (!response.ok) return null;
        return ((await response.json()).actor as Actor | null) ?? null;
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
    queryFn: async () => (await api<{ payments: Payment[] }>("/api/payments")).payments,
  });
}

export function usePayment(id: string | null, session: Session | undefined) {
  return useQuery({
    queryKey: ["payment", id],
    enabled: Boolean(id && session?.did),
    queryFn: async () =>
      (await api<{ payment: Payment }>(`/api/payments/${id}`)).payment,
  });
}

export function useInvitation(token: string | null, session: Session | undefined) {
  return useQuery({
    queryKey: ["invitation", token, session?.did],
    enabled: Boolean(token && session?.did),
    queryFn: async () =>
      (await api<{ payment: Payment }>(`/api/invitations/${token}`)).payment,
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
      const response = await fetch(`/api/actors/search?q=${encodeURIComponent(query)}`, {
        signal,
      });
      if (!response.ok) return [];
      return ((await response.json()).actors as Actor[]) ?? [];
    },
  });
}
