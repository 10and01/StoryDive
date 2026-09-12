import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 名场面二创工坊：读者把某个入局点的改写「发布」到公共池，
// 别人可在其后「接力盖楼」（parentPostId 指向被续写的那条），并可点赞。
// 与私密的 branches 表分开：这是全网公开、可投票、可接力的社会化内容池。
export const workshopPosts = sqliteTable(
  "workshop_posts",
  {
    id: text("id").primaryKey(),
    // 归属的名场面（聚合维度：作品 + 入局点段落）
    storyId: text("story_id").notNull(),
    storyTitle: text("story_title").notNull(),
    anchorParagraph: integer("anchor_paragraph").notNull().default(0),
    enterHint: text("enter_hint"), // 该入局点的抉择提示（冗余存储，便于殿堂聚合展示）
    kind: text("kind").notNull().default("rewrite"), // dialogue | fork | rewrite
    // 发布者（公开展示）
    authorId: text("author_id").notNull(),
    authorName: text("author_name"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // 接力盖楼链：parentPostId 指向被续写的那条；rootPostId 是整条链的起点；depth 为楼层
    parentPostId: text("parent_post_id"),
    rootPostId: text("root_post_id").notNull(),
    depth: integer("depth").notNull().default(0),
    // 缓存计数：点赞数 + 热度分（热度加权排序用）
    likeCount: integer("like_count").notNull().default(0),
    hotScore: real("hot_score").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sceneIdx: index("workshop_posts_scene_idx").on(
      table.storyId,
      table.anchorParagraph,
    ),
    rootIdx: index("workshop_posts_root_idx").on(table.rootPostId, table.depth),
    hotIdx: index("workshop_posts_hot_idx").on(table.hotScore),
    authorIdx: index("workshop_posts_author_idx").on(table.authorId),
  }),
);

export type WorkshopPostRow = InferSelectModel<typeof workshopPosts>;

// 点赞记录：一个用户对一条改写只能点一次（唯一约束去重）。
export const workshopVotes = sqliteTable(
  "workshop_votes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqVote: uniqueIndex("workshop_votes_post_user_uniq").on(
      table.postId,
      table.userId,
    ),
    userIdx: index("workshop_votes_user_idx").on(table.userId),
  }),
);

export type WorkshopVoteRow = InferSelectModel<typeof workshopVotes>;
