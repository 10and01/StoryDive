import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const customWorks = sqliteTable(
  "custom_works",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    ownerName: text("owner_name"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    tagsJson: text("tags_json").notNull().default("[]"),
    coverImage: text("cover_image"),
    themePrompt: text("theme_prompt"),
    sourceFormat: text("source_format").notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceObjectKey: text("source_object_key").notNull(),
    sourceOwnerId: text("source_owner_id"),
    sourceWorkId: text("source_work_id"),
    sourceWorkTitle: text("source_work_title"),
    visibility: text("visibility").notNull().default("private"),
    shareToken: text("share_token"),
    status: text("status").notNull().default("draft"),
    selectedProviderId: text("selected_provider_id"),
    publishedVersionId: text("published_version_id"),
    rightsConfirmed: integer("rights_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    rightsConfirmedAt: integer("rights_confirmed_at", { mode: "timestamp" }),
    rightsConfirmedBy: text("rights_confirmed_by"),
    safetyStatus: text("safety_status").notNull().default("pending"),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (table) => ({
    ownerIdx: index("custom_works_owner_idx").on(table.ownerId, table.updatedAt),
    publicIdx: index("custom_works_public_idx").on(
      table.visibility,
      table.status,
      table.publishedAt,
    ),
    shareTokenIdx: uniqueIndex("custom_works_share_token_uniq").on(table.shareToken),
  }),
);

export const customWorkVersions = sqliteTable(
  "custom_work_versions",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    storyJson: text("story_json").notNull(),
    generationJobId: text("generation_job_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workVersionUniq: uniqueIndex("custom_work_versions_work_version_uniq").on(
      table.workId,
      table.versionNumber,
    ),
    workIdx: index("custom_work_versions_work_idx").on(table.workId, table.createdAt),
    generationJobUniq: uniqueIndex("custom_work_versions_generation_job_uniq").on(
      table.generationJobId,
    ),
  }),
);

export const storyGenerationJobs = sqliteTable(
  "story_generation_jobs",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull(),
    versionId: text("version_id"),
    ownerId: text("owner_id").notNull(),
    status: text("status").notNull().default("queued"),
    stage: text("stage").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    providerSnapshotJson: text("provider_snapshot_json"),
    parsedSourceJson: text("parsed_source_json"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workIdx: index("story_generation_jobs_work_idx").on(table.workId, table.createdAt),
    ownerIdx: index("story_generation_jobs_owner_idx").on(table.ownerId, table.updatedAt),
    statusIdx: index("story_generation_jobs_status_idx").on(table.status, table.updatedAt),
  }),
);

export const customPlaySessions = sqliteTable(
  "custom_play_sessions",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull(),
    versionId: text("version_id").notNull(),
    userId: text("user_id").notNull(),
    progressJson: text("progress_json").notNull().default("{}"),
    currentChapter: integer("current_chapter").notNull().default(0),
    currentParagraph: integer("current_paragraph").notNull().default(0),
    stateJson: text("state_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workUserUniq: uniqueIndex("custom_play_sessions_work_user_uniq").on(
      table.workId,
      table.userId,
    ),
    userIdx: index("custom_play_sessions_user_idx").on(table.userId, table.updatedAt),
  }),
);

export const customPlayEvents = sqliteTable(
  "custom_play_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdx: index("custom_play_events_session_idx").on(table.sessionId, table.createdAt),
  }),
);

export const modelProviders = sqliteTable(
  "model_providers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    maskedApiKey: text("masked_api_key").notNull(),
    model: text("model").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("untested"),
    lastTestedAt: integer("last_tested_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index("model_providers_user_idx").on(table.userId, table.updatedAt),
    userNameUniq: uniqueIndex("model_providers_user_name_uniq").on(table.userId, table.name),
  }),
);

export type CustomWorkRow = InferSelectModel<typeof customWorks>;
export type CustomWorkVersionRow = InferSelectModel<typeof customWorkVersions>;
export type StoryGenerationJobRow = InferSelectModel<typeof storyGenerationJobs>;
export type CustomPlaySessionRow = InferSelectModel<typeof customPlaySessions>;
export type ModelProviderRow = InferSelectModel<typeof modelProviders>;
