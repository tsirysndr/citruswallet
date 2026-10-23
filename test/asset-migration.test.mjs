import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
test('asset migration preserves legacy ETH, history search and database integrity', t => {
  const db = new Database(':memory:'); t.after(() => db.close());
  for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql') && f < '0011_').sort()) db.exec(readFileSync('drizzle/' + file, 'utf8'));
  db.exec(`INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_wei,state,description,created_at,expires_at)
    VALUES('legacy','alice','bob','bob.test',1,'1234567890123456789012','cancelled','Legacy dinner',1,2)`);
  db.exec(readFileSync('drizzle/0011_windy_scream.sql', 'utf8'));
  const row = db.prepare('SELECT * FROM payments WHERE id=?').get('legacy');
  assert.equal(row.amount_atomic, '1234567890123456789012'); assert.equal(row.asset_decimals, 18); assert.equal(row.asset_symbol, 'ETH'); assert.equal(row.asset_contract, null);
  assert.equal(db.prepare("SELECT id FROM payments_fts WHERE payments_fts MATCH ?").get('"dinner"').id, 'legacy');
  db.exec("UPDATE payments SET description='Updated lunch' WHERE id='legacy'");
  assert.equal(db.prepare("SELECT id FROM payments_fts WHERE payments_fts MATCH ?").get('"lunch"').id, 'legacy');
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
});
