import {test} from 'node:test';
import assert from 'node:assert/strict';
import {open,close} from '../build/dev/javascript/peachlet/peachlet/store.mjs';
import {list,markRead,markAllRead,register,unregister,deliver} from './helpers/notifications.mjs';
function fixture(t){const store=open(':memory:','./drizzle')[0];t.after(()=>close(store));const db=store.client;
 const payment=(id='payment',recipient='bob',chain=1)=>db.prepare("INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,created_at,expires_at) VALUES(?,'alice',?,'bob.test',?,'1','submitted',1,9999999999999)").run(id,recipient,chain);
 const waiting=(id='invited',recipient='bob',sender='alice')=>db.prepare("INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,source,created_at,expires_at) VALUES(?,?,?,'bob.test',1,'1','waiting','default',1,9999999999999)").run(id,sender,recipient);
 const ready=(id='invited')=>db.prepare("UPDATE payments SET state='ready' WHERE id=?").run(id);
 return {db,payment,waiting,ready};}
test('only confirmed incoming payments create durable, deduplicated, participant-scoped notifications',t=>{const {db,payment}=fixture(t);payment();assert.equal(list(db,'bob',1).unread,0);db.prepare("UPDATE payments SET state='confirmed' WHERE id='payment'").run();assert.equal(list(db,'bob',1).unread,1);assert.equal(list(db,'alice',1).unread,0);assert.equal(list(db,'bob',31337).unread,0);db.exec("UPDATE payments SET state='confirming';UPDATE payments SET state='confirmed';");assert.equal(list(db,'bob',1).notifications.length,1);markRead(db,'alice',1,'1');assert.equal(list(db,'bob',1).unread,1);markRead(db,'bob',1,'1');assert.equal(list(db,'bob',1).unread,0);assert.equal(list(db,'bob',1).notifications[0].read,true);});
test('notification insertion is atomic with payment confirmation',t=>{const {db,payment}=fixture(t);payment();assert.throws(()=>db.transaction(()=>{db.exec("UPDATE payments SET state='confirmed'");throw new Error('rollback');})());assert.equal(list(db,'bob',1).unread,0);});
test('push delivery stores tickets and receipts, retries transport failures and removes invalid devices',async t=>{const {db,payment}=fixture(t),token='ExpoPushToken[test_device]';assert.equal(register(db,'bob','session',{token,platform:'android'}),true);db.exec('UPDATE push_devices SET created_at=0');payment();db.exec("UPDATE payments SET state='confirmed'");let calls=0;
 await deliver(db,async()=>{calls++;throw new Error('offline');});assert.equal(calls,1);assert.equal(db.prepare('SELECT state FROM push_deliveries').get().state,'pending');db.exec('UPDATE push_deliveries SET next_at=0');
 await deliver(db,async(url,options)=>{assert.equal(url,'https://exp.host/--/api/v2/push/send');const data=JSON.parse(options.body);assert.equal(data.data.paymentId,'payment');assert.ok(!data.body.includes('alice'));return Response.json({data:{status:'ok',id:'ticket'}});});assert.equal(db.prepare('SELECT state FROM push_deliveries').get().state,'receipt');db.exec('UPDATE push_deliveries SET next_at=0');
 await deliver(db,async()=>Response.json({data:{ticket:{status:'ok'}}}));assert.equal(db.prepare('SELECT state FROM push_deliveries').get().state,'delivered');
 await deliver(db,async()=>{throw new Error('must not resend');});
 payment('second');db.exec("UPDATE payments SET state='confirmed' WHERE id='second'");await deliver(db,async()=>Response.json({data:{status:'error',details:{error:'DeviceNotRegistered'}}}));assert.equal(db.prepare('SELECT count(*) AS n FROM push_devices').get().n,0);
});
test('device tokens are validated and another user cannot unregister them',t=>{const {db}=fixture(t),token='ExponentPushToken[test]';assert.equal(register(db,'bob','session',{token:'https://evil',platform:'android'}),false);register(db,'bob','session',{token,platform:'android'});unregister(db,'alice',token);assert.equal(db.prepare('SELECT did FROM push_devices').get().did,'bob');register(db,'alice','new-session',{token,platform:'ios'});assert.equal(db.prepare('SELECT did FROM push_devices').get().did,'alice');unregister(db,'alice',token);assert.equal(db.prepare('SELECT count(*) AS n FROM push_devices').get().n,0);});

test('mark all read is scoped to recipient and chain', t => {
 const {db,payment}=fixture(t);payment('one');payment('two');payment('other-user','charlie');payment('other-chain','bob',31337);db.exec("UPDATE payments SET state='confirmed'");
 markAllRead(db,'bob',1);assert.equal(list(db,'bob',1).unread,0);assert.equal(list(db,'charlie',1).unread,1);assert.equal(list(db,'bob',31337).unread,1);
});

/* Accepting an invitation and linking a wallet is observable as the payment
   becoming payable: the sender, not the recipient, is the one told. */
test('a waiting payment becoming ready notifies the sender once',t=>{const {db,waiting,ready}=fixture(t);waiting();assert.equal(list(db,'alice',1).unread,0);ready();
 const sent=list(db,'alice',1);assert.equal(sent.unread,1);assert.equal(sent.notifications[0].kind,'recipient_ready');assert.equal(sent.notifications[0].paymentId,'invited');
 assert.equal(list(db,'bob',1).unread,0);
 db.exec("UPDATE payments SET state='waiting' WHERE id='invited'");ready();assert.equal(list(db,'alice',1).notifications.length,1);
 assert.equal(list(db,'alice',31337).unread,0);});
test('an already payable or self-addressed payment notifies nobody',t=>{const {db,waiting,ready}=fixture(t);
 waiting('self','alice','alice');ready('self');assert.equal(list(db,'alice',1).unread,0);
 waiting('open');db.exec("UPDATE payments SET state='ready' WHERE id='open'");db.exec("UPDATE payments SET state='prepared' WHERE id='open'");assert.equal(list(db,'alice',1).notifications.filter(n=>n.paymentId==='open').length,1);});
test('both kinds coexist on one payment and stay scoped to their owner',t=>{const {db,waiting,ready}=fixture(t);waiting();ready();
 db.exec("UPDATE payments SET state='confirmed' WHERE id='invited'");
 assert.deepEqual(list(db,'alice',1).notifications.map(n=>n.kind),['recipient_ready']);
 assert.deepEqual(list(db,'bob',1).notifications.map(n=>n.kind),['payment_received']);});
test('incoming payment notifications keep their kind',t=>{const {db,payment}=fixture(t);payment();db.exec("UPDATE payments SET state='confirmed'");assert.equal(list(db,'bob',1).notifications[0].kind,'payment_received');});
