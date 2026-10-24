import { useEffect, useRef, useState } from 'react';
import type { Session } from './types';

export function useWalletOnboarding(ready: boolean, pending: boolean, session: Session | null | undefined, vault: string, address: string | null) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const checkedAccount = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ready || pending || (needsSetup === false && checkedAccount.current === session?.did)) return;
    checkedAccount.current = session?.did;
    const configured = vault !== 'absent' || Boolean(address) || Boolean(session?.links.length);
    setNeedsSetup(!session?.did || !configured);
  }, [ready, pending, session, vault, address, needsSetup]);
  return [needsSetup, setNeedsSetup] as const;
}
