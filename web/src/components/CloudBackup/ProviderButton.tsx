import type { CloudProvider } from '@peachlet/wallet-core';
import { Button } from '../ui';
export function ProviderButton({ provider, disabled, onClick }: { provider: CloudProvider; disabled: boolean; onClick: () => void }) {
  const google = provider === 'google';
  return <Button disabled={disabled} onClick={onClick} className="inline-flex min-h-12 items-center justify-center gap-3 px-5" style={{ backgroundColor: google ? '#ffffff' : '#0061ff', color: google ? '#1f1f1f' : '#ffffff', border: google ? '1px solid #c7c7c7' : '1px solid #0061ff' }}>
    {google ? <img src="/cloud/google-drive.png" alt="" width={24} height={24} /> : <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" /></svg>}
    {google ? 'Google Drive' : 'Dropbox'}
  </Button>;
}
