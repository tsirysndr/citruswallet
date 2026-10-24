import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { busyAtom, statusAtom } from "./atoms";

export function useStatus() {
  const setStatus = useSetAtom(statusAtom);
  return useCallback(
    (message: string, error = false) => setStatus({ message, error }),
    [setStatus],
  );
}

/* One operation at a time, and every failure lands in the status line. */
export function useRun() {
  const store = useStore();
  return useCallback(
    async (operation: () => Promise<unknown>) => {
      if (store.get(busyAtom)) return;
      store.set(busyAtom, true);
      try {
        await operation();
      } catch (error: any) {
        store.set(statusAtom, {
          message:
            error?.code === 4001
              ? "Request declined. No new transfer was approved."
              : (error?.message ?? "Request failed."),
          error: true,
        });
      } finally {
        store.set(busyAtom, false);
      }
    },
    [store],
  );
}

const refreshed = [
  "session",
  "payments",
  "payment",
  "profile",
  "balances",
  "assets",
  "invitation",
];

export function useRefresh() {
  const queries = useQueryClient();
  return useCallback(
    () =>
      Promise.all(
        refreshed.map((key) => queries.invalidateQueries({ queryKey: [key] })),
      ),
    [queries],
  );
}
