export { listing as list, mark_read as markRead, mark_all_read as markAllRead, register, unregister } from '../../build/dev/javascript/peachlet/peachlet/notifications.mjs';
import { deliver as processQueue } from '../../build/dev/javascript/peachlet/peachlet/notification_worker.mjs';
import { send as sendWeb } from '../../build/dev/javascript/peachlet/peachlet/web_push.mjs';
import { invoke } from '../../src/notification_transport.mjs';
export function deliver(db, send=fetch, now=Date.now(), webSend) {
  return processQueue(db, send, now, webSend ? (...args) => invoke(webSend,args) : sendWeb);
}
