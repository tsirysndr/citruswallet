// Keep invitation secrets in the fragment, outside HTTP requests and access logs.
export function invitationToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    const web = parsed.protocol === "https:" && parsed.hostname === "citruswallet.app" && !parsed.port && ["/invite", "/"].includes(parsed.pathname);
    const native = parsed.protocol === "citruswallet:" && parsed.hostname === "invite" && !parsed.pathname;
    if ((!web && !native) || parsed.username || parsed.password) return null;
    const values = new URLSearchParams(parsed.hash.slice(1)).getAll("invite");
    return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]!) ? values[0]! : null;
  } catch { return null; }
}
