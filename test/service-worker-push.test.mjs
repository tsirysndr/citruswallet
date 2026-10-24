import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('service worker displays generic deduplicated notifications and opens only local payment URLs',async()=>{
 const handlers={},shown=[],opened=[];
 const self={location:{origin:'https://peachlet.app'},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(readFileSync('web/public/sw.js','utf8'),{self,URL,encodeURIComponent,Set});
 let done;handlers.push({data:{json:()=>({paymentId:'payment-1',notificationId:'5',body:'private details'})},waitUntil:p=>done=p});await done;
 assert.equal(shown[0][1].tag,'payment-payment-1');assert.equal(shown[0][1].body,'Open Peachlet to view your payment.');
 handlers.notificationclick({notification:{data:shown[0][1].data,close(){}},waitUntil:p=>done=p});await done;
 assert.equal(opened[0],'/payments?notificationPayment=payment-1&notificationId=5&chainId=1');
 handlers.notificationclick({notification:{data:{paymentId:'https://evil.test'},close(){}},waitUntil:p=>done=p});await done;
 assert.equal(opened[1],'/activity');
});
