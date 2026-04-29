CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`monthly_extraction_credits` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`interval` text NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`provider_price_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prices_product_id_idx` ON `prices` (`product_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `product_id` integer REFERENCES products(id);--> statement-breakpoint
INSERT INTO `products` (`slug`, `name`, `description`, `monthly_extraction_credits`, `sort_order`, `is_default`, `status`) VALUES
	('free', 'Free', 'Try DocExtract — perfect for kicking the tires.', 10, 0, 1, 'active'),
	('pro', 'Pro', 'For teams shipping document workflows in production.', 500, 1, 0, 'active'),
	('enterprise', 'Enterprise', 'Unlimited extractions, priority support and custom SLAs.', NULL, 2, 0, 'active');
--> statement-breakpoint
INSERT INTO `prices` (`product_id`, `amount`, `currency`, `interval`, `interval_count`) VALUES
	((SELECT id FROM products WHERE slug = 'free'), 0, 'USD', 'free', 1),
	((SELECT id FROM products WHERE slug = 'pro'), 1900, 'USD', 'month', 1),
	((SELECT id FROM products WHERE slug = 'pro'), 19000, 'USD', 'year', 1),
	((SELECT id FROM products WHERE slug = 'enterprise'), 49900, 'USD', 'month', 1);
--> statement-breakpoint
UPDATE `users` SET `product_id` = (SELECT id FROM products WHERE slug = 'free') WHERE `product_id` IS NULL;
