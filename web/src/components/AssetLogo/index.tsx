import { useState } from 'react';
import { tokenLogo } from '../../../../app/src/token-logos';
import type { Asset } from '../../assets';
export function AssetLogo({ asset }: { asset: Asset }) {
  const url = tokenLogo(asset);
  const [failed, setFailed] = useState<string>();
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sunken text-sm font-semibold text-ink-muted">
    {url && failed !== url ? <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailed(url)} /> : asset.symbol.slice(0, 2).toUpperCase()}
  </span>;
}
