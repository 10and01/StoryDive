import type { InferSelectModel } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// 名场面法庭·投票：一个用户对一场庭审只计一票，可在红/蓝之间改投（唯一约束去重）。
// 庭审内容由 AI 现生成、不落库；这里只记「哪场(caseId) 的哪一方(side) 得了谁(userId)的票」。
export const courtVotes = sqliteTable(
  "court_votes",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    userId: text("user_id").notNull(),
    side: text("side").notNull(), // red | blue
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqVote: uniqueIndex("court_votes_case_user_uniq").on(
      table.caseId,
      table.userId,
    ),
    caseIdx: index("court_votes_case_idx").on(table.caseId),
  }),
);

export type CourtVoteRow = InferSelectModel<typeof courtVotes>;
