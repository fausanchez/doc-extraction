CREATE INDEX `templates_user_id_idx` ON `templates` (`user_id`);--> statement-breakpoint
CREATE INDEX `documents_user_id_idx` ON `documents` (`user_id`);--> statement-breakpoint
CREATE INDEX `extractions_user_id_idx` ON `extractions` (`user_id`);--> statement-breakpoint
CREATE INDEX `extractions_document_id_idx` ON `extractions` (`document_id`);
