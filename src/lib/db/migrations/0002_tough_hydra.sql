CREATE TABLE `custom_play_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_play_events_session_idx` ON `custom_play_events` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_play_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`version_id` text NOT NULL,
	`user_id` text NOT NULL,
	`progress_json` text DEFAULT '{}' NOT NULL,
	`current_chapter` integer DEFAULT 0 NOT NULL,
	`current_paragraph` integer DEFAULT 0 NOT NULL,
	`state_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_play_sessions_work_user_uniq` ON `custom_play_sessions` (`work_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `custom_play_sessions_user_idx` ON `custom_play_sessions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `custom_work_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`story_json` text NOT NULL,
	`generation_job_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_work_versions_work_version_uniq` ON `custom_work_versions` (`work_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `custom_work_versions_work_idx` ON `custom_work_versions` (`work_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_works` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`cover_image` text,
	`theme_prompt` text,
	`source_format` text NOT NULL,
	`source_file_name` text NOT NULL,
	`source_object_key` text NOT NULL,
	`source_owner_id` text,
	`source_work_id` text,
	`source_work_title` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`share_token` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`selected_provider_id` text,
	`published_version_id` text,
	`rights_confirmed` integer DEFAULT false NOT NULL,
	`rights_confirmed_at` integer,
	`rights_confirmed_by` text,
	`safety_status` text DEFAULT 'pending' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE INDEX `custom_works_owner_idx` ON `custom_works` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `custom_works_public_idx` ON `custom_works` (`visibility`,`status`,`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_works_share_token_uniq` ON `custom_works` (`share_token`);--> statement-breakpoint
CREATE TABLE `model_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`masked_api_key` text NOT NULL,
	`model` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'untested' NOT NULL,
	`last_tested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_providers_user_idx` ON `model_providers` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_providers_user_name_uniq` ON `model_providers` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `story_generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`version_id` text,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text,
	`provider_snapshot_json` text,
	`parsed_source_json` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `story_generation_jobs_work_idx` ON `story_generation_jobs` (`work_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `story_generation_jobs_owner_idx` ON `story_generation_jobs` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `story_generation_jobs_status_idx` ON `story_generation_jobs` (`status`,`updated_at`);