import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { open, close } from '../build/dev/javascript/peachlet/peachlet/store.mjs';
import { Payments, Filters, history } from '../build/dev/javascript/peachlet/peachlet/payments.mjs';

function fixture(t) {
  const store = open(':memory:', './drizzle')[0];
  t.after(() => close(store));
  const db = store.client;
  db.transaction(() => {
    const put = db.prepare(`INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,created_at,expires_at)
      VALUES(?,?,?,'recipient.test',?,'1',?,?,?)`);
    const profile = db.prepare('INSERT INTO user_profiles(did,handle,display_name) VALUES(?,?,?)');
    for (let i = 0; i < 1000; i++) profile.run(`did:plc:user${i}`, `user${i}.test`, `Person ${i}`);
    for (let i = 0; i < 12000; i++) put.run(`payment-${i}`, `did:plc:user${i % 1000}`, `did:plc:user${(i + 1) % 1000}`, i % 3 ? 1 : 11155111, ['confirmed','ready','waiting','cancelled'][i % 4], 100000 + Math.floor(i / 4), 999999);
  })();
  db.exec('ANALYZE');
  return { db, payments: new Payments(store, null, null, '', 1, null, () => 200000, 1) };
}

// Capture actual SQL and bound parameters from the Gleam history implementation.
function historyPlans(db, operation) {
  const prepare = db.prepare;
  const queries = [];
  db.prepare = function(sql) {
    const statement = prepare.call(this, sql);
    if (/^select /i.test(sql)) for (const method of ['get', 'all']) {
      const run = statement[method];
      statement[method] = function(...params) { queries.push({ sql, params }); return run.apply(this, params); };
    }
    return statement;
  };
  try { operation(); } finally { db.prepare = prepare; }
  return queries.map(({ sql, params }) => ({ sql, plan: db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...params).map(row => row.detail).join('\n') }));
}

test('actual activity queries use participant/chain indexes, indexed profile lookups, and stable indexed sorting', t => {
  const { db, payments } = fixture(t);
  for (const direction of ['sent', 'received', 'all']) {
    for (const status of ['all', 'confirmed', 'ready', 'expired']) {
      for (const search of ['', 'Pe', 'Person', "100%_ ' literal"]) {
        for (const sort of ['newest', 'oldest']) {
          const plans = historyPlans(db, () => history(payments, 'did:plc:user1', new Filters(search, direction, status, 0, 9999999, 1, 20, sort)));
          assert.equal(plans.length, 2, 'count and page query');
          for (const { plan } of plans) {
            assert.doesNotMatch(plan, /SCAN payments\b|SCAN user_profiles\b/i, plan);
            assert.match(plan, /SEARCH payments USING (?:COVERING )?INDEX payments_by_/, plan);
            if (search.length >= 3) {
              assert.match(plan, /payments_fts VIRTUAL TABLE INDEX \d+:M/, plan);
              assert.match(plan, /user_profiles_fts VIRTUAL TABLE INDEX \d+:M/, plan);
              assert.doesNotMatch(plan, /CORRELATED SCALAR SUBQUERY/, plan);
            } else if (search) {
              assert.match(plan, /CORRELATED SCALAR SUBQUERY/, plan);
              assert.match(plan, /SEARCH user_profiles USING INDEX .*\(did=\?\)/, plan);
            }
            if (direction !== 'all' && status !== 'expired') assert.doesNotMatch(plan, /TEMP B-TREE/, plan);
          }
        }
      }
    }
  }
});

test('cleanup, wallet listings, repository revisions, and exact lookups have matching indexes', t => {
  const { db } = fixture(t);
  const cases = [
    ['DELETE FROM kv WHERE expires<=?', [100], 'kv_by_expiry'],
    ["UPDATE payments SET state='expired' WHERE state=? AND expires_at<=?", ['prepared',100], 'payments_prepared_expiry'],
    ['DELETE FROM challenges WHERE expires<=?', [100], 'challenges_by_expiry'],
    ['DELETE FROM challenges WHERE session=?', ['session'], 'challenges_by_session'],
    ['SELECT * FROM links WHERE did=? ORDER BY linked_at DESC', ['did'], 'links_by_owner_time'],
    ['SELECT * FROM links WHERE did=? AND public=1 ORDER BY linked_at DESC', ['did'], 'links_by_owner_time'],
    ['SELECT record FROM address_repository_records WHERE did=? AND chain_id=? AND address=? AND record IS NOT NULL ORDER BY rev DESC LIMIT 1', ['did',1,'address'], 'address_repository_latest'],
    ['SELECT value FROM kv WHERE namespace=? AND key=? AND expires>?', ['ns','key',100], 'sqlite_autoindex_kv_1'],
    ['SELECT key,value FROM kv WHERE namespace=? ORDER BY key LIMIT 1', ['ns'], 'sqlite_autoindex_kv_1'],
    ['SELECT * FROM payments WHERE id=? AND chain_id=?', ['id',1], 'sqlite_autoindex_payments_1'],
    ['SELECT * FROM payments WHERE invitation_hash=? AND chain_id=?', ['hash',1], 'payments_invitation_hash_unique'],
    ['SELECT * FROM user_profiles WHERE did=?', ['did'], 'user_profiles_did_unique'],
  ];
  for (const [sql, args, index] of cases) {
    const plan = db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...args).map(row => row.detail).join('\n');
    assert.ok(plan.includes(index), `${sql}\n${plan}`);
    assert.doesNotMatch(plan, /SCAN |TEMP B-TREE/, plan);
  }
});

test('index migration preserves existing records and uniqueness constraints', () => {
  const db = new Database(':memory:');
  try {
    const files = readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort();
    for (const file of files.filter(file => file < '0006_')) db.exec(readFileSync('drizzle/' + file, 'utf8'));
    db.exec(`INSERT INTO kv VALUES('session','key','private',123);
      INSERT INTO challenges VALUES('challenge','session','did','address','message',123,1);
      INSERT INTO links VALUES('did','address',1,'message','signature','2026-01-01',1,1);
      INSERT INTO user_profiles(did,handle) VALUES('did','alice.test');
      INSERT INTO address_repository_records VALUES('did','key','rev',1,'address','{}');
      INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_wei,state,created_at,expires_at,description,media)
        VALUES('payment','did','recipient','recipient.test',1,'1','cancelled',123,456,'Dinner','{}');`);
    const tables = ['kv','challenges','links','user_profiles','address_repository_records','payments'];
    const before = tables.map(table => db.prepare(`SELECT * FROM ${table}`).all());
    db.exec(readFileSync('drizzle/' + files.find(file => file.startsWith('0006_')), 'utf8'));
    for (const [i, table] of tables.entries()) assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(), before[i]);
    assert.throws(() => db.exec("INSERT INTO user_profiles(did,handle) VALUES('did','duplicate.test')"), /UNIQUE constraint/);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  } finally { db.close(); }
});
