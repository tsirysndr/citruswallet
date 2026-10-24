import { useSyncExternalStore } from 'react';
import { hasSignedIn } from '../../api';
import { useSession } from '../../hooks';
import { nativeVaultState, subscribeNativeVault } from '../../local-wallet';
import { configuredAddress } from '../../wallet-preferences';
import { OnboardingSignIn } from '../OnboardingSignIn';
import { WalletSetup } from '../WalletSetup';

export function WalletEntry({ onFinished }: { onFinished: () => void }) {
  const { data: session } = useSession();
  const vault = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const returning = hasSignedIn() || vault === 'locked' || vault === 'unlocked' || Boolean(configuredAddress());
  if (!session?.did && returning) return <OnboardingSignIn returning />;
  return <WalletSetup key={session?.did || 'signed-out'} onFinished={onFinished} />;
}
