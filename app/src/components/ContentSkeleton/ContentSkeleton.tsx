import { useTheme } from '../../theme';
import { Fragment, useEffect, useId, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import ContentLoader, { Circle, Rect } from "react-content-loader/native";
export function ContentSkeleton({ variant = "rows", rows = 3, label = "Loading content", inverse = false }: { variant?: "rows" | "card" | "media" | "line"; rows?: number; label?: string; inverse?: boolean }) {
  const { appearance } = useTheme();
  const dark = inverse || appearance === 'dark';
  const id = useId();
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  const height = variant === "media" ? 232 : variant === "card" ? 184 : variant === "line" ? 36 : rows * 72;
  const shapes = variant === "media" ? [0, 1, 2, 3, 4, 5].map(i => <Rect key={i} x={(i % 3) * 122} y={Math.floor(i / 3) * 120} width={112} height={112} rx={8} />) :
    variant === "line" ? <Rect x={0} y={8} width={240} height={20} rx={5} /> :
    variant === "card" ? <><Rect x={0} y={8} width={160} height={20} rx={5} /><Rect x={0} y={48} width={280} height={32} rx={6} /><Rect x={0} y={104} width={340} height={14} rx={4} /><Rect x={0} y={132} width={230} height={14} rx={4} /><Rect x={0} y={162} width={140} height={16} rx={4} /></> :
    Array.from({ length: rows }, (_, i) => <Fragment key={i}><Circle cx={24} cy={i * 72 + 26} r={22} /><Rect x={60} y={i * 72 + 8} width={180} height={14} rx={4} /><Rect x={60} y={i * 72 + 32} width={120} height={12} rx={4} /><Rect x={286} y={i * 72 + 14} width={70} height={18} rx={4} /></Fragment>);

  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}
    style={{ width: "100%", aspectRatio: 360 / height }}>
    <ContentLoader key={reduced ? "static" : "animated"} uniqueKey={id} accessible={false} animate={!reduced} speed={1.6}
      width="100%" height="100%" viewBox={`0 0 360 ${height}`}
      backgroundColor={dark ? "#292929" : "#e4e5dc"} foregroundColor={dark ? "#404040" : "#f5f7ee"}>
      {shapes}
    </ContentLoader>
  </View>;
}
