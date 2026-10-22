PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_profiles` (
	`id` integer PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_user_profiles`("did", "handle", "display_name", "avatar", "created_at", "updated_at") SELECT "did", "handle", "display_name", "avatar", "created_at", "updated_at" FROM `user_profiles`;--> statement-breakpoint
DROP TABLE `user_profiles`;--> statement-breakpoint
ALTER TABLE `__new_user_profiles` RENAME TO `user_profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_did_unique` ON `user_profiles` (`did`);