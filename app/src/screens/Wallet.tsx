import { useAtom } from "jotai";
import { walletSetupAtom } from "../state";
import { WalletSetup } from "../components/WalletSetup";
export function Wallet() {
  const [restart, setRestart] = useAtom(walletSetupAtom);
  return (
    <WalletSetup
      key={String(restart)}
      restart={restart}
      onFinished={restart ? () => setRestart(false) : undefined}
    />
  );
}
