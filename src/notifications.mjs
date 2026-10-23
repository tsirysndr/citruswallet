import { streamSSE } from "hono/streaming";
const active = new Map();
const encode = (row) => ({
  id: String(row.id),
  paymentId: row.payment_id,
  createdAt: String(row.created_at),
  read: row.read_at !== null,
});
const alive = (db, key, did) =>
  db
    .prepare(
      "SELECT 1 FROM kv WHERE namespace IN ('browser','native-session') AND key=? AND expires>? AND json_extract(value,'$.did')=?",
    )
    .get(key, Date.now(), did);
export function list(db, did, chain) {
  const notifications = db
    .prepare(
      "SELECT * FROM notifications WHERE did=? AND chain_id=? ORDER BY id DESC LIMIT 50",
    )
    .all(did, chain)
    .map(encode);
  const unread = db
    .prepare(
      "SELECT count(*) AS count FROM notifications WHERE did=? AND chain_id=? AND read_at IS NULL",
    )
    .get(did, chain).count;
  return { notifications, unread };
}
export function markRead(db, did, chain, id) {
  db.prepare(
    "UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE did=? AND chain_id=? AND id=?",
  ).run(Date.now(), did, chain, id);
  return { ok: true };
}
export function register(db, did, key, body) {
  if (
    !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(body.token) ||
    !["android", "ios"].includes(body.platform)
  )
    return false;
  db.prepare(
    "INSERT INTO push_devices(token,did,session_key,platform,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET did=excluded.did,session_key=excluded.session_key,platform=excluded.platform,created_at=CASE WHEN push_devices.did=excluded.did THEN push_devices.created_at ELSE excluded.created_at END,updated_at=excluded.updated_at",
  ).run(body.token, did, key, body.platform, Date.now(), Date.now());
  return true;
}
export function unregister(db, did, token) {
  db.prepare("DELETE FROM push_devices WHERE did=? AND token=?").run(
    did,
    token,
  );
  return { ok: true };
}
export function stream(db, ctx, did, key, chain) {
  const raw = ctx.req.header("last-event-id") || ctx.req.query("cursor") || "0";
  if (!/^\d{1,15}$/.test(raw))
    return ctx.json(
      { error: "InvalidRequest", message: "Invalid notification cursor." },
      400,
    );
  if ((active.get(key) || 0) >= 4)
    return ctx.json(
      { error: "RateLimitExceeded", message: "Too many notification streams." },
      429,
    );
  active.set(key, (active.get(key) || 0) + 1);
  ctx.header("X-Accel-Buffering", "no");
  return streamSSE(ctx, async (output) => {
    let cursor = Number(raw),
      aborted = false,
      tick = 0;
    output.onAbort(() => {
      aborted = true;
    });
    try {
      await output.writeSSE({ event: "ready", data: "{}", retry: 3000 });
      while (!aborted) {
        if (!alive(db, key, did)) {
          await output.writeSSE({ event: "session-expired", data: "{}" });
          break;
        }
        const rows = db
          .prepare(
            "SELECT * FROM notifications WHERE did=? AND chain_id=? AND id>? ORDER BY id LIMIT 100",
          )
          .all(did, chain, cursor);
        for (const row of rows) {
          await output.writeSSE({
            event: "payment-received",
            id: String(row.id),
            data: JSON.stringify(encode(row)),
          });
          cursor = row.id;
        }
        if (++tick % 8 === 0) await output.write(": heartbeat\n\n");
        await output.sleep(2000);
      }
    } finally {
      const count = (active.get(key) || 1) - 1;
      if (count) active.set(key, count);
      else active.delete(key);
    }
  });
}
const retry = (db, job, message, now) =>
  db
    .prepare(
      "UPDATE push_deliveries SET state=?,error=?,next_at=? WHERE notification_id=? AND token=?",
    )
    .run(
      job.attempts >= 8 ? "failed" : "pending",
      String(message).slice(0, 200),
      now + Math.min(3600000, 5000 * 2 ** job.attempts),
      job.notification_id,
      job.token,
    );
export async function deliver(db, send = fetch, now = Date.now()) {
  db.prepare(
    `INSERT OR IGNORE INTO push_deliveries(notification_id,token,state,attempts,next_at)
    SELECT n.id,d.token,'pending',0,? FROM notifications n JOIN push_devices d ON d.did=n.did
    WHERE n.created_at>=d.created_at AND n.created_at>? AND n.read_at IS NULL`,
  ).run(now, now - 7 * 86400000);
  const jobs = db
    .prepare(
      "SELECT j.*,n.did,n.payment_id,d.session_key FROM push_deliveries j JOIN notifications n ON n.id=j.notification_id JOIN push_devices d ON d.token=j.token AND d.did=n.did WHERE j.state IN ('pending','sending','receipt') AND j.next_at<=? ORDER BY j.next_at LIMIT 50",
    )
    .all(now);
  for (const job of jobs) {
    const claimed = db
      .prepare(
        "UPDATE push_deliveries SET next_at=?,attempts=attempts+1,state=? WHERE notification_id=? AND token=? AND next_at<=?",
      )
      .run(
        now + 60000,
        job.state === "receipt" ? "receipt" : "sending",
        job.notification_id,
        job.token,
        now,
      );
    if (!claimed.changes) continue;
    job.attempts++;
    try {
      const receipts = job.state === "receipt";
      const response = await send(
        `https://exp.host/--/api/v2/push/${receipts ? "getReceipts" : "send"}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify(
            receipts
              ? { ids: [job.ticket] }
              : {
                  to: job.token,
                  title: "Payment received",
                  body: "Open Citrus Wallet to view your payment.",
                  sound: "default",
                  channelId: "payments",
                  data: {
                    notificationId: String(job.notification_id),
                    paymentId: job.payment_id,
                  },
                },
          ),
        },
      );
      if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
      const payload = await response.json();
      const ticket = receipts ? payload.data?.[job.ticket] : payload.data;
      if (!ticket) {
        if (receipts && job.attempts < 8) {
          db.prepare(
            "UPDATE push_deliveries SET state='receipt',next_at=? WHERE notification_id=? AND token=?",
          ).run(now + 900000, job.notification_id, job.token);
          continue;
        }
        throw new Error("Missing Expo receipt");
      }
      if (ticket.status === "error") {
        if (ticket.details?.error === "DeviceNotRegistered")
          db.prepare("DELETE FROM push_devices WHERE token=?").run(job.token);
        throw new Error(ticket.details?.error || "Push rejected");
      }
      if (ticket.status !== "ok" || (!receipts && !ticket.id))
        throw new Error("Invalid Expo response");
      db.prepare(
        "UPDATE push_deliveries SET state=?,ticket=?,error=NULL,next_at=? WHERE notification_id=? AND token=?",
      ).run(
        receipts ? "delivered" : "receipt",
        receipts ? job.ticket : ticket.id,
        now + 900000,
        job.notification_id,
        job.token,
      );
    } catch (error) {
      if (job.state === "receipt")
        db.prepare(
          "UPDATE push_deliveries SET state=?,error=?,next_at=? WHERE notification_id=? AND token=?",
        ).run(
          job.attempts >= 8 ? "failed" : "receipt",
          String(error.message).slice(0, 200),
          now + 900000,
          job.notification_id,
          job.token,
        );
      else retry(db, job, error.message, now);
    }
  }
}
export function start(db, checkPayment, chain) {
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const payments = db
        .prepare(
          "SELECT p.id,p.sender_did FROM payments p LEFT JOIN kv k ON k.namespace='payment-check' AND k.key=p.id WHERE p.chain_id=? AND p.state IN ('submitted','confirming') ORDER BY COALESCE(CAST(k.value AS INTEGER),0),p.created_at LIMIT 10",
        )
        .all(chain);
      for (const p of payments) {
        if (stopped) break;
        db.prepare(
          "INSERT INTO kv(namespace,key,value,expires) VALUES('payment-check',?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,expires=excluded.expires",
        ).run(p.id, String(Date.now()), Date.now() + 7 * 86400000);
        await checkPayment(p.id, p.sender_did);
      }
      if (!stopped) await deliver(db);
    } catch (error) {
      console.error("Notification worker failed:", error.name);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
