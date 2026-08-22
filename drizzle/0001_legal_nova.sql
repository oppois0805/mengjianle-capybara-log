ALTER TABLE `injections` ADD `profile` text DEFAULT 'wenwen' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_injections_profile_injection_date` ON `injections` (`profile`,`injection_date`);--> statement-breakpoint
ALTER TABLE `purchases` ADD `profile` text DEFAULT 'wenwen' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_purchases_profile_purchase_date` ON `purchases` (`profile`,`purchase_date`);