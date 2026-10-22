import { metamaskStoreUrl, useMetaMask } from "../metamask";

export function InstallMetaMask() {
  const detected = useMetaMask();
  if (detected) return null;
  return (
    <a
      href={metamaskStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-2 rounded-[6px] bg-accent px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap text-accent-ink hover:brightness-105 sm:text-xs"
    >
      <img src="/metamask.png" alt="" width={26} height={26} />
      <span>Install MetaMask</span>
    </a>
  );
}
