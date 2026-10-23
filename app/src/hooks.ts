import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { busyAtom, noticeAtom, readyAtom } from "./state";
import { ApiError, request, saveToken } from "./api";
import type { Actor, Session } from "./types";
export function useSession() {
  const ready = useAtomValue(readyAtom);
  return useQuery({
    queryKey: ["session"],
    enabled: ready,
    queryFn: async () => {
      try {
        return await request<Session>("getSession");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await saveToken(null);
          return null;
        }
        throw error;
      }
    },
  });
}
export function useProfile() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["profile", session?.did],
    enabled: !!session?.did,
    queryFn: async () => (await request<{ actor: Actor }>("getProfile")).actor,
  });
}
export function useAction() {
  const store = useStore(),
    query = useQueryClient();
  const setNotice = useSetAtom(noticeAtom);
  return async (fn: () => Promise<unknown>) => {
    if (store.get(busyAtom)) return;
    store.set(busyAtom, true);
    setNotice("");
    try {
      await fn();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      if (error instanceof ApiError && error.status === 401) {
        await saveToken(null);
        await query.resetQueries();
      }
    } finally {
      store.set(busyAtom, false);
    }
  };
}
