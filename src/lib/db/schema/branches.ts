import type { InferSelectModel } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// User-grown story branches: dialogue transcripts, fork outcomes, rewrites.
export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    storyId: text("story_id").notNull(),
    storyTitle: text("story_title").notNull(),
    kind: text("kind").notNull(), // dialogue | fork | rewrite
    anchorParagraph: integer("anchor_paragraph").notNull().default(0),
    // 父支线 id：从某条支线的场景继续「往下玩」时长出的子节点指向它；
    // 为空表示这是直接从原著入局点长出的根支线。用于「个人叙事树」的父子结构。
    parentId: text("parent_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index("branches_user_idx").on(table.userId),
    userCreatedIdx: index("branches_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    userStoryIdx: index("branches_user_story_idx").on(
      table.userId,
      table.storyId,
    ),
  }),
);

export type BranchRow = InferSelectModel<typeof branches>;
