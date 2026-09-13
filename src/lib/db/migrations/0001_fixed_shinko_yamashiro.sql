CREATE TABLE `court_cases` (
	`date` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`source` text NOT NULL,
	`question_url` text,
	`case_title` text NOT NULL,
	`brief` text,
	`red_angle` text,
	`blue_angle` text,
	`tags_json` text,
	`evidence_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `court_cases_case_idx` ON `court_cases` (`case_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile_json` text,
	`contents_json` text,
	`followees_json` text,
	`consent_contents` integer DEFAULT false NOT NULL,
	`consent_followees` integer DEFAULT false NOT NULL,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
