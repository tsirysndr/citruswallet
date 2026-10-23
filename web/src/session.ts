import { lockLocalWallet } from "./local-wallet";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { rpc, onUnauthorized, rememberCsrf } from "./api";
import { acknowledgedAtom, invitationUrlAtom, reviewIdAtom, statusAtom } from "./atoms";
import { useSession } from "./queries";
import type { Session } from "./types";

const privateQueries = new Set(["profile", "payments", "payment", "invitation", "balances"]);

export function useSessionGuard() {
  const { data: session } = useSession();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const setReview = useSetAtom(reviewIdAtom);
  const setInvitation = useSetAtom(invitationUrlAtom);
  const setAcknowledged = useSetAtom(acknowledgedAtom);
  const setStatus = useSetAtom(statusAtom);
  const did = session?.did;

  useEffect(() => {
    if (!did) return;
    let disposed = false;
    let checking = false;
    let grace: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (disposed || checking || queries.getQueryData<Session>(["session"])?.did !== did) return;
      checking = true;
      try {
        // Only a successful session response can confirm that the login is gone.
        const current = await rpc.getSession();
        if (disposed || queries.getQueryData<Session>(["session"])?.did !== did) return;
        rememberCsrf(current.csrf);
        if (current.did !== did) {
          lockLocalWallet();
          await queries.cancelQueries({ predicate: (query) => privateQueries.has(String(query.queryKey[0])) });
          if (disposed) return;
          queries.removeQueries({ predicate: (query) => privateQueries.has(String(query.queryKey[0])) });
          setReview(null);
          setInvitation(null);
          setAcknowledged(false);
          // Keep the broadcast recovery ledger: logging out must not lose an in-flight transfer.
          setStatus({ message: current.did ? "Your account changed." : "Your session expired. Please sign in again.", error: !current.did });
          void navigate({ to: "/" });
        }
        queries.setQueryData(["session"], current);
      } catch {
        // Offline, server errors, and failed profile lookups are not proof of an invalid login.
      } finally {
        checking = false;
      }
    };

    const schedule = () => {
      if (grace !== undefined) return;
      grace = setTimeout(() => { grace = undefined; void check(); }, 3000);
    };
    const unsubscribe = onUnauthorized(schedule);
    schedule();
    const interval = setInterval(schedule, 30_000);
    window.addEventListener("focus", schedule);
    return () => {
      disposed = true;
      unsubscribe();
      clearInterval(interval);
      clearTimeout(grace);
      window.removeEventListener("focus", schedule);
    };
  }, [did, queries, navigate, setReview, setInvitation, setAcknowledged, setStatus]);
}
