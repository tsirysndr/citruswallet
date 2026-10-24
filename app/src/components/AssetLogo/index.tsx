import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../Typography';
import { tokenLogo } from '../../token-logos';
import type { Asset } from '../../assets';
export function AssetLogo({ asset }: { asset: Asset }) {
  const url = tokenLogo(asset);
  const [failed, setFailed] = useState<string>();
  return <View accessible={false} style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f1ed' }}>
    {url && failed !== url ? <Image source={{ uri: url }} style={{ width: 40, height: 40 }} contentFit="contain" onError={() => setFailed(url)} /> : <Text className="text-sm font-semibold text-muted">{asset.symbol.slice(0, 2).toUpperCase()}</Text>}
  </View>;
}
