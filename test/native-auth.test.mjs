import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {begin,complete,exchange} from '../src/native-auth.mjs';
import {open,close} from '../build/dev/javascript/citruswallet/citruswallet/store.mjs';
const verifier='a'.repeat(64),state='b'.repeat(64),hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(t){const store=open(':memory:','./drizzle')[0];t.after(()=>close(store));return store.client;}
function code(db){assert.equal(begin(db,`https://citruswallet.app/auth/native/start?challenge=${hash(verifier)}&state=${state}`,'oauth'),true);const url=new URL(complete(db,'oauth','did:plc:alice'));assert.equal(url.protocol,'citruswallet:');assert.equal(url.hostname,'auth');assert.equal(url.searchParams.get('state'),state);assert.equal(url.searchParams.has('token'),false);return url.searchParams.get('code');}
test('native authorization codes are proof-bound, single-use and produce hashed credentials',t=>{const db=fixture(t),value=code(db);assert.equal(exchange(db,{code:value,verifier:'c'.repeat(64)}),null);const result=exchange(db,{code:value,verifier});assert.match(result.token,/^[a-f0-9]{64}$/);assert.equal(exchange(db,{code:value,verifier}),null);const row=db.prepare("SELECT key,value FROM kv WHERE namespace='native-session'").get();assert.equal(row.key,hash(result.token));assert.equal(JSON.parse(row.value).did,'did:plc:alice');assert.equal(complete(db,'oauth','did:plc:alice'),'/');});
test('native login rejects malformed proof and expired codes',t=>{const db=fixture(t);assert.equal(begin(db,'https://citruswallet.app/auth/native/start?challenge=x&state=x','oauth'),false);const value=code(db);db.prepare("UPDATE kv SET expires=0 WHERE namespace='native-code'").run();assert.equal(exchange(db,{code:value,verifier}),null);for(const body of [{},{code:'x',verifier},{code:value,verifier:'x'}])assert.equal(exchange(db,body),null);});
