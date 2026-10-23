import type { PaymentMedia } from "./types";

export type MediaKind = "gifs" | "stickers" | "static-memes" | "clips";
export const mediaKinds: { value: MediaKind; label: string }[] = [
  { value: "gifs", label: "GIFs" }, { value: "stickers", label: "Stickers" },
  { value: "static-memes", label: "Memes" }, { value: "clips", label: "Clips" },
];
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { Buffer } from 'buffer';
const apiKey: string = Constants.expoConfig?.extra?.klipyApiKey || '';
export const klipyEnabled = Boolean(apiKey);
export type KlipyItem = { media: PaymentMedia | null; title: string };
export function safeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || /[\\\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ["static.klipy.com", "static1.klipy.com", "static2.klipy.com"].includes(url.hostname);
  } catch { return false; }
}
// KLIPY clips use direct format URLs; GIFs/stickers/memes use size/format objects.
export function parseItem(item: unknown, kind: MediaKind): KlipyItem {
  const data = item as { slug?: string; title?: string; file?: Record<string, unknown> };
  const title = typeof data?.title === "string" ? data.title : "KLIPY media";
  const file = data?.file as Record<string, Record<string, { url?: string }>> | undefined;
  const url = kind === "clips" ? data?.file?.mp4 : file?.md?.webp?.url ?? file?.hd?.webp?.url ?? file?.hd?.gif?.url ?? file?.hd?.png?.url;
  const preview = kind === "clips" ? data?.file?.webp ?? data?.file?.gif : file?.sm?.webp?.url ?? file?.sm?.gif?.url ?? file?.sm?.png?.url ?? url;
  const valid = safeMediaUrl(url) && safeMediaUrl(preview) && typeof data.slug === "string" && Buffer.byteLength(data.slug, "utf8") <= 200 && data.slug.length > 0;
  return { title, media: valid ? { kind, slug: data.slug!, url, preview, title: [...title].slice(0, 70).join("") } : null };
}
let anonymousId: Promise<string> | undefined;
function customerId() {
  return anonymousId ??= (async () => {
    const stored = await AsyncStorage.getItem('citrus-klipy-id');
    if (stored) return stored;
    const id = randomUUID();
    await AsyncStorage.setItem('citrus-klipy-id', id);
    return id;
  })();
}
export async function fetchMedia(kind: MediaKind, query: string, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), per_page: "24", customer_id: await customerId() });
  if (query) params.set("q", query);
  let response: Response;
  try { response = await fetch(`https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/${kind}/${query ? "search" : "trending"}?${params}`, { signal, credentials: "omit", referrerPolicy: "no-referrer" }); }
  catch (error) { if (signal.aborted) throw error; throw new Error("Could not reach KLIPY. Please try again."); }
  if (!response.ok) throw new Error(response.status === 429 ? "KLIPY is busy. Please try again shortly." : "Could not load KLIPY media. Please try again.");
  const payload = await response.json();
  if (!payload.result || !Array.isArray(payload.data?.data)) throw new Error("KLIPY returned an unexpected response. Please try again.");
  // Preserve provider ordering; unavailable results retain their position.
  return { items: payload.data.data.map((item: unknown) => parseItem(item, kind)) as KlipyItem[], hasNext: payload.data.has_next === true };
}
export async function recordShare(media: PaymentMedia, query: string) {
  if (!apiKey) return;
  try { await fetch(`https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/${media.kind}/share/${encodeURIComponent(media.slug)}`, {
    method: "POST", credentials: "omit", referrerPolicy: "no-referrer", headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer_id: await customerId(), q: query }), signal: AbortSignal.timeout(5000),
  }); } catch { /* Provider analytics must never interrupt a created payment. */ }
}
