import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { open, close } from '../build/dev/javascript/peachlet/peachlet/store.mjs';
import { Payments, Filters, history } from '../build/dev/javascript/peachlet/peachlet/payments.mjs';

const alice = 'did:plc:alice';
const bob = 'did:plc:bob';
function fixture(t) {
  const store = open(':memory:', './drizzle')[0];
  t.after(() => close(store));
  const db = store.client;
  const service = new Payments(store, null, null, '', 1, null, () => 100, 12);
  const put = (id, description = 'Dinner', sender = alice, recipient = bob, chain = 1) =>
    db.prepare(`INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,description,created_at,expires_at)
      VALUES(?,?,?,'bob.test',?,'1','cancelled',?,10,1000)`).run(id,sender,recipient,chain,description);
  const search = (q, direction = 'all', page = 1, pageSize = 20) => history(service, alice, new Filters(q,direction,'all',0,1000,page,pageSize,'newest'));
  const ids = (q, direction) => Array.from(search(q, direction).payments).map(p => p.id);
  return { db, put, search, ids };
}

function integrity(db) {
  for (const table of ['payments_fts', 'user_profiles_fts'])
    db.prepare(`INSERT INTO ${table}(${table},rank) VALUES ('integrity-check',1)`).run();
}

test('FTS activity matches literal substrings, Unicode, punctuation and short queries', t => {
  const { db, put, ids } = fixture(t);
  put('literal', 'Lunch 100%_ literal "OR" NEAR(foo) café 東京駅');
  for (const q of ['LUNCH','unch','100%_','"OR"','NEAR(foo)','café','東京駅','Lu','%','駅','"'])
    assert.deepEqual(ids(q), ['literal'], q);
  for (const q of ['missing', 'Lunch OR missing', "' OR 1=1 --", '*', '" OR "'])
    assert.deepEqual(ids(q), [], q);
  for (const [column, value, query] of [
    ['address','0xabcdef0123456789','cdef012'],
    ['from_address','0x9876543210fedcba','3210fed'],
    ['tx_hash','0xdeadbeef112233','BEEF112'],
  ]) {
    db.prepare(`UPDATE payments SET ${column}=? WHERE id='literal'`).run(value);
    assert.deepEqual(ids(query), ['literal']);
  }
  assert.deepEqual(ids('plc:bob'), ['literal']);
  assert.deepEqual(ids('bob.te'), ['literal']);
  integrity(db);
});

test('FTS results stay participant and chain scoped with stable pagination', t => {
  const { put, search, ids } = fixture(t);
  put('sent-a'); put('sent-b'); put('received', 'Dinner', bob, alice);
  put('private', 'Dinner', 'did:plc:other', bob);
  put('other-chain', 'Dinner', alice, bob, 31337);
  assert.equal(search('inn').total, 3);
  assert.deepEqual(ids('inn', 'sent'), ['sent-b','sent-a']);
  assert.deepEqual(ids('inn', 'received'), ['received']);
  assert.deepEqual(Array.from(search('inn','all',2,1).payments).map(p => p.id), ['sent-a']);
  assert.equal(search('inn','all',4,1).total, 3);
  assert.equal(Array.from(search('inn','all',4,1).payments).length, 0);
});

test('payment FTS insert, update, delete and rollback remain consistent', t => {
  const { db, put, ids } = fixture(t);
  put('payment', 'Original');
  db.prepare("UPDATE payments SET description='Replacement' WHERE id='payment'").run();
  assert.deepEqual(ids('Original'), []);
  assert.deepEqual(ids('place'), ['payment']);
  assert.throws(() => db.transaction(() => {
    db.prepare("UPDATE payments SET description='Rollback' WHERE id='payment'").run();
    put('rolled-back', 'Rollback');
    throw new Error('abort');
  })(), /abort/);
  assert.deepEqual(ids('Rollback'), []);
  assert.deepEqual(ids('place'), ['payment']);
  db.prepare("DELETE FROM payments WHERE id='payment'").run();
  assert.deepEqual(ids('place'), []);
  integrity(db);
});

test('profile inserts, upserts and deletion update existing activity without duplicates', t => {
  const { db, put, ids, search } = fixture(t);
  put('payment');
  assert.deepEqual(ids('Robert'), []);
  const profile = db.prepare(`INSERT INTO user_profiles(did,handle,display_name) VALUES(?,?,?)
    ON CONFLICT(did) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name`);
  profile.run(bob, 'bobby.test', 'Robert Peachlet');
  assert.deepEqual(ids('bert pea'), ['payment']);
  profile.run(alice, 'alice.test', 'Robert Peachlet');
  assert.equal(search('Robert').total, 1);
  profile.run(bob, 'renamed.test', null);
  assert.deepEqual(ids('bobby'), []);
  assert.deepEqual(ids('renamed'), ['payment']);
  db.prepare('DELETE FROM user_profiles WHERE did=?').run(alice);
  assert.deepEqual(ids('Robert'), []);
  db.prepare('DELETE FROM user_profiles WHERE did=?').run(bob);
  assert.deepEqual(ids('renamed'), []);
  integrity(db);
});

test('FTS migration backfills existing payments and profiles', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql') && f < '0007_').sort())
    db.exec(readFileSync('drizzle/' + file, 'utf8'));
  db.exec(`INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_wei,state,description,created_at,expires_at)
    VALUES('old','alice','bob','bob.test',1,'1','cancelled','Legacy dinner',1,2);
    INSERT INTO user_profiles(did,handle,display_name) VALUES('bob','legacy.test','Legacy Bob');`);
  db.exec(readFileSync('drizzle/0007_activity_fts.sql', 'utf8'));
  assert.deepEqual(db.prepare("SELECT id FROM payments_fts WHERE payments_fts MATCH ?").all('"dinner"'), [{ id:'old' }]);
  assert.deepEqual(db.prepare("SELECT did FROM user_profiles_fts WHERE user_profiles_fts MATCH ?").all('"Legacy"'), [{ did:'bob' }]);
  integrity(db);
});
