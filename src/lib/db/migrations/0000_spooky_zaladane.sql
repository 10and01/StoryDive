CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`story_id` text NOT NULL,
	`story_title` text NOT NULL,
	`kind` text NOT NULL,
	`anchor_paragraph` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `branches_user_idx` ON `branches` (`user_id`);--> statement-breakpoint
CREATE INDEX `branches_user_created_idx` ON `branches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `branches_user_story_idx` ON `branches` (`user_id`,`story_id`);--> statement-breakpoint
CREATE TABLE `court_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`user_id` text NOT NULL,
	`side` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `court_votes_case_user_uniq` ON `court_votes` (`case_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `court_votes_case_idx` ON `court_votes` (`case_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE TABLE `workshop_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`story_title` text NOT NULL,
	`anchor_paragraph` integer DEFAULT 0 NOT NULL,
	`enter_hint` text,
	`kind` text DEFAULT 'rewrite' NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`parent_post_id` text,
	`root_post_id` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`hot_score` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workshop_posts_scene_idx` ON `workshop_posts` (`story_id`,`anchor_paragraph`);--> statement-breakpoint
CREATE INDEX `workshop_posts_root_idx` ON `workshop_posts` (`root_post_id`,`depth`);--> statement-breakpoint
CREATE INDEX `workshop_posts_hot_idx` ON `workshop_posts` (`hot_score`);--> statement-breakpoint
CREATE INDEX `workshop_posts_author_idx` ON `workshop_posts` (`author_id`);--> statement-breakpoint
CREATE TABLE `workshop_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workshop_votes_post_user_uniq` ON `workshop_votes` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `workshop_votes_user_idx` ON `workshop_votes` (`user_id`);