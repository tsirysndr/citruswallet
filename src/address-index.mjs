import { isValidDid } from '@atproto/syntax';
import { verifyMessage } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { lexicons } from './xrpc.mjs';

export const ADDRESS_COLLECTION = 'app.peachlet.address';
export const recordKey = (chain, address) => `eip155-${chain}-${address.toLowerCase()}`;
const revision = /^[234567abcdefghijklmnopqrstuvwxyz]{13}$/;
export const validRevision = value => typeof value === 'string' && revision.test(value);
export function saveRecordHead(db, did, rkey, rev, record) {
  if (!validRevision(rev)) return;
  db.prepare(`INSERT INTO address_repository_records(did,rkey,rev,chain_id,address,record) VALUES(?,?,?,?,?,?)
    ON CONFLICT(did,rkey) DO UPDATE SET rev=excluded.rev,chain_id=excluded.chain_id,address=excluded.address,record=excluded.record
    WHERE excluded.rev > address_repository_records.rev`).run(did, rkey, rev,
      record ? Number(record.chain.slice(7)) : null, record?.address.toLowerCase() ?? null, record ? JSON.stringify(record) : null);
}

export const needsPublication = (db, did, chain, address) => !db.prepare(
  `SELECT 1 FROM address_repository_records WHERE did=? AND chain_id=? AND address=? AND record IS NOT NULL AND json_extract(record, '$.$type') = 'app.peachlet.address' LIMIT 1`,
).get(did, chain, address.toLowerCase());

async function verifiedRecord(record, did, origin) {
  if (!record || record.$type !== ADDRESS_COLLECTION || !lexicons.validate(ADDRESS_COLLECTION, record).success) return null;
  if (!/^eip155:(1|4326|6343|31337)$/.test(record.chain) || !/^0x[0-9a-fA-F]{40}$/.test(record.address)) return null;
  const proof = parseSiweMessage(record.message);
  if (proof.address?.toLowerCase() !== record.address.toLowerCase()
    || proof.chainId !== Number(record.chain.slice(7)) || proof.version !== '1'
    || proof.domain !== new URL(origin).host || proof.uri !== `${origin}/wallet-link`
    || !proof.resources?.includes(did)
    || proof.statement !== `Link this wallet to AT Protocol account ${did}. This does not authorize transactions.`
    || !proof.issuedAt || !proof.expirationTime || proof.expirationTime <= proof.issuedAt
    || proof.issuedAt.getTime() > Date.now() + 300_000) return null;
  // A persisted linking proof remains valid after its challenge expires.
  // Never treat this signature as permission to execute a transfer.
  if (!await verifyMessage({ address: record.address, message: record.message, signature: record.signature })) return null;
  return { ...record, address: record.address.toLowerCase() };
}

function pending(db, did, chain, address) {
  return db.prepare('SELECT 1 FROM kv WHERE namespace=? AND key=?').get(`address-record:${did}`, recordKey(chain, address));
}

function project(db, did, chain, address, fallbackRecord = null) {
  if (!address || !chain || pending(db, did, chain, address)) return;
  const source = db.prepare(`SELECT record FROM address_repository_records WHERE did=? AND chain_id=? AND address=? AND record IS NOT NULL ORDER BY rev DESC LIMIT 1`).get(did, chain, address);
  const existing = db.prepare('SELECT * FROM links WHERE did=? AND chain_id=? AND address=?').get(did, chain, address);
  if (!source) {
    // Do not remove a private local proof or a newly relinked wallet when an
    // old public record is deleted. The current outbox takes precedence.
    if (existing?.public && (!fallbackRecord || existing.signature === fallbackRecord.signature)) {
      db.prepare('DELETE FROM links WHERE did=? AND chain_id=? AND address=? AND public=1').run(did, chain, address);
    }
    return;
  }
  const record = JSON.parse(source.record);
  if (existing && (!existing.public || Date.parse(existing.linked_at) > Date.parse(record.createdAt))) return;
  const owner = db.prepare('SELECT did FROM links WHERE chain_id=? AND address=?').get(chain, address);
  if (owner && owner.did !== did) return;
  const hasDefault = db.prepare('SELECT 1 FROM links WHERE did=? AND chain_id=? AND is_default=1').get(did, chain);
  db.prepare(`INSERT INTO links(did,address,chain_id,message,signature,linked_at,public,is_default) VALUES(?,?,?,?,?,?,1,?)
    ON CONFLICT(did,address,chain_id) DO UPDATE SET message=excluded.message,signature=excluded.signature,linked_at=excluded.linked_at,public=1`)
    .run(did, address, chain, record.message, record.signature, record.createdAt, hasDefault ? 0 : 1);
}

export async function applyAddressEvent(db, event, origin, checkpoint = () => {}, ensureProfile = async () => true) {
  const { did, commit } = event;
  if (!isValidDid(did ?? '') || commit?.collection !== ADDRESS_COLLECTION || !validRevision(commit.rev)
    || typeof commit.rkey !== 'string' || !/^[a-zA-Z0-9._~:-]{1,512}$/.test(commit.rkey)
    || ['.', '..'].includes(commit.rkey) || !['create', 'update', 'delete'].includes(commit.operation)) {
    db.transaction(checkpoint)();
    return 'ignored';
  }
  const prior = db.prepare('SELECT * FROM address_repository_records WHERE did=? AND rkey=?').get(did, commit.rkey);
  if (prior && prior.rev >= commit.rev) {
    db.transaction(checkpoint)();
    return 'duplicate';
  }
  if (!await ensureProfile(did)) throw new Error("Could not index event profile");
  let record = null;
  if (commit.operation !== 'delete') {
    try { record = await verifiedRecord(commit.record, did, origin); } catch { /* invalid proof withdraws the old mapping */ }
  }
  return db.transaction(() => {
    const old = db.prepare('SELECT * FROM address_repository_records WHERE did=? AND rkey=?').get(did, commit.rkey);
    if (old && old.rev >= commit.rev) { checkpoint(); return 'duplicate'; }
    saveRecordHead(db, did, commit.rkey, commit.rev, record);
    if (old?.record) project(db, did, old.chain_id, old.address, JSON.parse(old.record));
    else if (!record) {
      // A delete can be the first event after deployment for an existing local
      // link. Only our deterministic key can identify that otherwise-unseen row.
      const match = /^eip155-(1|4326|6343|31337)-(0x[0-9a-f]{40})$/.exec(commit.rkey);
      if (match) project(db, did, Number(match[1]), match[2]);
    }
    if (record) project(db, did, Number(record.chain.slice(7)), record.address);
    checkpoint();
    return record ? 'applied' : commit.operation === 'delete' ? 'deleted' : 'invalid';
  })();
}
