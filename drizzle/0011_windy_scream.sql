ALTER TABLE `payments` RENAME COLUMN "amount_wei" TO "amount_atomic";--> statement-breakpoint
ALTER TABLE `payments` ADD `asset_contract` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `asset_symbol` text DEFAULT 'ETH' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `asset_name` text DEFAULT 'Ether' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `asset_decimals` integer DEFAULT 18 NOT NULL;