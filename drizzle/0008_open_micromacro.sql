CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`payment_id` text NOT NULL,
	`chain_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_payment_recipient` ON `notifications` (`payment_id`,`did`);--> statement-breakpoint
CREATE INDEX `notifications_owner_cursor` ON `notifications` (`did`,`chain_id`,`id`);--> statement-breakpoint
CREATE INDEX `notifications_owner_unread` ON `notifications` (`did`,`chain_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`notification_id` integer NOT NULL,
	`token` text NOT NULL,
	`state` text NOT NULL,
	`attempts` integer NOT NULL,
	`next_at` integer NOT NULL,
	`ticket` text,
	`error` text,
	PRIMARY KEY(`notification_id`, `token`)
);
--> statement-breakpoint
CREATE INDEX `push_delivery_due` ON `push_deliveries` (`state`,`next_at`);--> statement-breakpoint
CREATE TABLE `push_devices` (
	`token` text PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`session_key` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_devices_owner` ON `push_devices` (`did`);--> statement-breakpoint
CREATE INDEX `push_devices_session` ON `push_devices` (`session_key`);--> statement-breakpoint
CREATE TRIGGER payment_received_notification AFTER UPDATE OF state ON payments
WHEN new.state = 'confirmed' AND old.state != 'confirmed' AND new.sender_did != new.recipient_did
BEGIN
  INSERT OR IGNORE INTO notifications(did,payment_id,chain_id,created_at)
  VALUES(new.recipient_did,new.id,new.chain_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
END;
--> statement-breakpoint
CREATE TRIGGER payment_received_notification_insert AFTER INSERT ON payments
WHEN new.state = 'confirmed' AND new.sender_did != new.recipient_did
BEGIN
  INSERT OR IGNORE INTO notifications(did,payment_id,chain_id,created_at)
  VALUES(new.recipient_did,new.id,new.chain_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
END;
