import { Fragment, useEffect, useId, useState } from "react";
import ContentLoader from "react-content-loader";
export function ContentSkeleton({ variant = "rows", rows = 3, label = "Loading content", inverse = false }: { variant?: "rows" | "card" | "media" | "line"; rows?: number; label?: string; inverse?: boolean }) {
  const id = useId();
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const height = variant === "media" ? 232 : variant === "card" ? 184 : variant === "line" ? 36 : rows * 72;
  const shapes = variant === "media" ? [0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={(i % 3) * 122} y={Math.floor(i / 3) * 120} width={112} height={112} rx={8} />) :
    variant === "line" ? <rect x={0} y={8} width={240} height={20} rx={5} /> :
    variant === "card" ? <><rect x={0} y={8} width={160} height={20} rx={5} /><rect x={0} y={48} width={280} height={32} rx={6} /><rect x={0} y={104} width={340} height={14} rx={4} /><rect x={0} y={132} width={230} height={14} rx={4} /><rect x={0} y={162} width={140} height={16} rx={4} /></> :
    Array.from({ length: rows }, (_, i) => <Fragment key={i}><circle cx={24} cy={i * 72 + 26} r={22} /><rect x={60} y={i * 72 + 8} width={180} height={14} rx={4} /><rect x={60} y={i * 72 + 32} width={120} height={12} rx={4} /><rect x={286} y={i * 72 + 14} width={70} height={18} rx={4} /></Fragment>);

  return <div role="status" aria-label={label} aria-busy="true" className="w-full min-w-0" style={{ maxWidth: variant === "line" ? 360 : 560 }}>
    <ContentLoader uniqueKey={id} title="" aria-hidden="true" animate={!reduced} speed={1.6}
      width="100%" viewBox={`0 0 360 ${height}`} style={{ display: "block", width: "100%", height: "auto" }}
      backgroundColor={inverse ? "#3c4332" : "#e4e5dc"} foregroundColor={inverse ? "#61704a" : "#f5f7ee"}>
      {shapes}
    </ContentLoader>
  </div>;
}
