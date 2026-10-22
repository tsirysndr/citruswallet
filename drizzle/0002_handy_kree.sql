CREATE TABLE `address_repository_records` (
	`did` text NOT NULL,
	`rkey` text NOT NULL,
	`rev` text NOT NULL,
	`chain_id` integer,
	`address` text,
	`record` text,
	PRIMARY KEY(`did`, `rkey`)
);
--> statement-breakpoint
CREATE INDEX `address_repository_lookup` ON `address_repository_records` (`did`,`chain_id`,`address`);