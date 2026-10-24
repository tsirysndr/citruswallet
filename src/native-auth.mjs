import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
const hash = (text) => createHash("sha256").update(text).digest("hex");
const read = (db, ns, key) =>
  db
    .prepare("SELECT value FROM kv WHERE namespace=? AND key=? AND expires>?")
    .get(ns, key, Date.now())?.value;
const put = (db, ns, key, value, ttl) =>
  db
    .prepare(
      "INSERT INTO kv(namespace,key,value,expires) VALUES(?,?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,expires=excluded.expires",
    )
    .run(ns, key, JSON.stringify(value), Date.now() + ttl);
const remove = (db, ns, key) =>
  db.prepare("DELETE FROM kv WHERE namespace=? AND key=?").run(ns, key);
// Only fixed app redirect URLs are permitted. No access token travels in a URL.
export function begin(db, url, oauthState) {
  const p = new URL(url).searchParams;
  const challenge = p.get("challenge"),
    state = p.get("state");
  if (
    !/^[a-f0-9]{64}$/.test(challenge ?? "") ||
    !/^[a-f0-9]{64}$/.test(state ?? "")
  )
    return false;
  put(db, "native-binding", oauthState, { challenge, state }, 600000);
  return true;
}
export function complete(db, oauthState, did) {
  const raw = read(db, "native-binding", oauthState);
  if (!raw) return "/";
  const binding = JSON.parse(raw);
  remove(db, "native-binding", oauthState);
  const code = randomBytes(32).toString("hex");
  put(db, "native-code", hash(code), { ...binding, did }, 60000);
  return `peachlet://auth?code=${code}&state=${binding.state}`;
}
export function exchange(db, body) {
  const { code, verifier } = body;
  if (
    !/^[a-f0-9]{64}$/.test(code ?? "") ||
    !/^[a-f0-9]{64}$/.test(verifier ?? "")
  )
    return null;
  return db.transaction(() => {
    const raw = read(db, "native-code", hash(code));
    if (!raw) return null;
    const binding = JSON.parse(raw);
    if (
      !timingSafeEqual(
        Buffer.from(binding.challenge),
        Buffer.from(hash(verifier)),
      )
    )
      return null;
    remove(db, "native-code", hash(code));
    const token = randomBytes(32).toString("hex");
    put(
      db,
      "native-session",
      hash(token),
      {
        did: binding.did,
        csrf: randomBytes(32).toString("hex"),
        createdAt: Date.now(),
        scopeVersion: 1,
      },
      28800000,
    );
    return { token };
  })();
}
