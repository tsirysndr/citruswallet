// Keep invitation secrets in the fragment, outside HTTP requests and access logs.
export function invitationToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    const web = parsed.protocol === "https:" && parsed.hostname === "peachlet.app" && !parsed.port && ["/invite", "/"].includes(parsed.pathname);
    const native = parsed.protocol === "peachlet:" && parsed.hostname === "invite" && !parsed.pathname;
    if ((!web && !native) || parsed.username || parsed.password) return null;
    const values = new URLSearchParams(parsed.hash.slice(1)).getAll("invite");
    return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]!) ? values[0]! : null;
  } catch { return null; }
}

export function invitationChain(url: string): string | null {
  if (!invitationToken(url)) return null;
  const chain = new URL(url).searchParams.get("chainId") || "1";
  return ["1", "4326", "6343"].includes(chain) ? chain : null;
}
