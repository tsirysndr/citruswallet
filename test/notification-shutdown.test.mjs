import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {stream,closeStreams} from '../src/notification_transport.mjs';
test('notification shutdown terminates open SSE streams',async()=>{
 const app=new Hono();app.get('/events',c=>stream(c,'session',4,()=>({expired:false,events:[]})));
 const response=await app.request('/events');const reader=response.body.getReader();
 const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/ready/);
 closeStreams();
 let complete=false;
 const timeout=new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('stream did not close')),4000);timer.unref();});
 await Promise.race([(async()=>{while(!(await reader.read()).done){}complete=true;})(),timeout]);
 assert.equal(complete,true);
});
