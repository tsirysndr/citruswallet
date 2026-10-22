DROP INDEX `address_repository_lookup`;--> statement-breakpoint
CREATE INDEX `address_repository_latest` ON `address_repository_records` (`did`,`chain_id`,`address`,"rev" desc) WHERE "record" IS NOT NULL;--> statement-breakpoint
DROP INDEX `payments_by_sender`;--> statement-breakpoint
DROP INDEX `payments_by_recipient`;--> statement-breakpoint
CREATE INDEX `payments_by_sender_chain_time` ON `payments` (`sender_did`,`chain_id`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `payments_by_sender_chain_state_time` ON `payments` (`sender_did`,`chain_id`,`state`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `payments_by_recipient_chain_time` ON `payments` (`recipient_did`,`chain_id`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `payments_by_recipient_chain_state_time` ON `payments` (`recipient_did`,`chain_id`,`state`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `payments_prepared_expiry` ON `payments` (`expires_at`) WHERE "state" = 'prepared';--> statement-breakpoint
CREATE INDEX `challenges_by_expiry` ON `challenges` (`expires`);--> statement-breakpoint
CREATE INDEX `challenges_by_session` ON `challenges` (`session`);--> statement-breakpoint
CREATE INDEX `kv_by_expiry` ON `kv` (`expires`);--> statement-breakpoint
CREATE INDEX `links_by_owner_time` ON `links` (`did`,"linked_at" desc);