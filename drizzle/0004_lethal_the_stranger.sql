ALTER TABLE `payments` ADD `description` text;--> statement-breakpoint
CREATE INDEX `payments_by_recipient` ON `payments` (`recipient_did`,"created_at" desc);