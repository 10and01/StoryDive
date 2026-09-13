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

// 全站每日一题：知乎画像推荐的真实问题 → AI 改写成红蓝案由 → 证据池。
// 「同题+个性化演绎」——所有观众共享同一辩题（court_votes 仍按 caseId 聚合），
// 个性化体现在立论角度与证据选择，不落在辩题上。当天命中即不再消耗推荐/摘要额度。
export const courtCases = sqliteTable(
  "court_cases",
  {
    date: text("date").primaryKey(), // YYYY-MM-DD（UTC，与 caseId 口径一致）
    caseId: text("case_id").notNull(),
    source: text("source").notNull(), // recommended | pool
    questionUrl: text("question_url"), // 推荐案由来源的真实知乎问题（供「深挖」）
    caseTitle: text("case_title").notNull(),
    brief: text("brief"),
    redAngle: text("red_angle"),
    blueAngle: text("blue_angle"),
    tagsJson: text("tags_json"),
    // 证据池（EvidencePool JSON）：emotion/logic 分池 + 全局编号；空值时开庭可重试构建
    evidenceJson: text("evidence_json"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    caseIdx: index("court_cases_case_idx").on(table.caseId),
  }),
);

export type CourtCaseRow = InferSelectModel<typeof courtCases>;
export type CourtVoteRow = InferSelectModel<typeof courtVotes>;
