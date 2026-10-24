ALTER TABLE `notifications` ADD `kind` text DEFAULT 'payment_received' NOT NULL;
--> statement-breakpoint
-- A waiting payment becomes ready exactly when the pinned recipient gains a
-- usable receiving address: they accepted the invitation and chose a linked
-- wallet, or a wallet they linked became their public default. Tell the sender,
-- once per payment. Existing rows keep the column default, so the two payment
-- triggers above continue to record incoming payments.
CREATE TRIGGER recipient_ready_notification AFTER UPDATE OF state ON payments
WHEN new.state = 'ready' AND old.state = 'waiting' AND new.sender_did != new.recipient_did
BEGIN
  INSERT OR IGNORE INTO notifications(did,payment_id,chain_id,kind,created_at)
  VALUES(new.sender_did,new.id,new.chain_id,'recipient_ready',CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
END;
