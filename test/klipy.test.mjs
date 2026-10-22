import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItem, safeMediaUrl } from '../web/src/klipy.ts';

test('KLIPY normalizes image and clip responses without rewriting delivery URLs', () => {
  const url = 'https://static.klipy.com/image.webp?token=abc&size=md';
  const preview = 'https://static2.klipy.com/preview.webp';
  const base = { slug: 'thanks', title: 'Thanks!' };
  for (const kind of ['gifs', 'stickers', 'static-memes']) {
    const result = parseItem({ ...base, file: { md: { webp: { url } }, sm: { webp: { url: preview } } } }, kind);
    assert.deepEqual(result.media, { ...base, kind, url, preview });
  }
  const clip = parseItem({ ...base, file: { mp4: 'https://static.klipy.com/clip.mp4', webp: preview } }, 'clips');
  assert.equal(clip.media.url, 'https://static.klipy.com/clip.mp4');
  assert.equal(clip.media.preview, preview);
  assert.equal(parseItem({ ...base, file: {} }, 'gifs').media, null);
});

test('KLIPY does not render untrusted URLs or malformed media as attachments', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,x', 'https://static.klipy.com.evil.test/x', 'https://user@static.klipy.com/x', 'https://static.klipy.com:444/x', 'https://static.klipy.com/\\evil.test/x', 'https://example.com/x']) assert.equal(safeMediaUrl(url), false);
  assert.equal(parseItem(null, 'gifs').media, null);
});
