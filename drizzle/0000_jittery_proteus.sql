CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`did` text NOT NULL,
	`address` text NOT NULL,
	`message` text NOT NULL,
	`expires` integer NOT NULL,
	`public` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kv` (
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`namespace`, `key`)
);
--> statement-breakpoint
CREATE TABLE `links` (
	`did` text NOT NULL,
	`address` text NOT NULL,
	`chain_id` integer NOT NULL,
	`message` text NOT NULL,
	`signature` text NOT NULL,
	`linked_at` text NOT NULL,
	`public` integer NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`did`, `address`, `chain_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_default_per_chain` ON `links` (`did`,`chain_id`) WHERE "is_default" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `links_address_chain` ON `links` (`address`,`chain_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_did` text NOT NULL,
	`recipient_did` text NOT NULL,
	`recipient_label` text NOT NULL,
	`chain_id` integer NOT NULL,
	`amount_wei` text NOT NULL,
	`state` text NOT NULL,
	`source` text DEFAULT 'default' NOT NULL,
	`address` text,
	`fingerprint` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`invitation_hash` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`attempt_id` text,
	`from_address` text,
	`nonce` integer,
	`prepared_at` integer,
	`tx_hash` text,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_invitation_hash_unique` ON `payments` (`invitation_hash`);--> statement-breakpoint
CREATE INDEX `payments_by_sender` ON `payments` (`sender_did`,"created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `reserved_payment_nonce` ON `payments` (`chain_id`,`from_address`,`nonce`) WHERE "state" IN ('prepared','submitted','confirming','confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX `payments_chain_tx` ON `payments` (`chain_id`,`tx_hash`);