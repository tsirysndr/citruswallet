CREATE TABLE `user_profiles` (
	`did` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`created_at` integer,
	`updated_at` integer
);
