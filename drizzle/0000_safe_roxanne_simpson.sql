CREATE TABLE `injections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`injection_date` text NOT NULL,
	`injection_time` text DEFAULT '' NOT NULL,
	`location` text NOT NULL,
	`next_injection_date` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_injections_injection_date` ON `injections` (`injection_date`);--> statement-breakpoint
CREATE INDEX `idx_injections_location` ON `injections` (`location`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_date` text NOT NULL,
	`purchase_time` text DEFAULT '' NOT NULL,
	`purchase_count` integer DEFAULT 1 NOT NULL,
	`total_amount` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_purchases_purchase_date` ON `purchases` (`purchase_date`);