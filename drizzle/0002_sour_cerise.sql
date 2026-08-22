CREATE TABLE `weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile` text DEFAULT 'wenwen' NOT NULL,
	`record_date` text NOT NULL,
	`record_time` text DEFAULT '' NOT NULL,
	`weight_kg` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_weights_record_date` ON `weights` (`record_date`);--> statement-breakpoint
CREATE INDEX `idx_weights_profile_record_date` ON `weights` (`profile`,`record_date`);