import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../Typography';
import { tokenLogo } from '../../token-logos';
import type { Asset } from '../../assets';
export function AssetLogo({ asset, size = 40 }: { asset: Asset; size?: number }) {
  const url = tokenLogo(asset);
  const [failed, setFailed] = useState<string>();
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f1ed' }}>
    {url && failed !== url ? <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="contain" onError={() => setFailed(url)} /> : <Text className="text-sm font-semibold text-muted">{asset.symbol.slice(0, 2).toUpperCase()}</Text>}
  </View>;
}
