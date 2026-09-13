import type { InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 用户画像：知乎授权数据经 AI 提炼后的缓存与各数据源同意开关。
// OAuth token 1 小时过期且无刷新（oauth.md），所以这里只存提炼结果，
// 不存回答原文与 token；「重新同步」走重新授权。
export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  // AI 提炼的结构化画像（UserProfile JSON：keywords/interests/tone/summary）
  profileJson: text("profile_json"),
  // 判例卡（UserContentCard JSON 数组）：标题+摘要+赞同数+链接，喂给对戏/法庭引用
  contentsJson: text("contents_json"),
  // 影子卡（FolloweeCard JSON 数组）：关注的人的公开资料，供影子 NPC 演绎
  followeesJson: text("followees_json"),
  consentContents: integer("consent_contents", { mode: "boolean" })
    .notNull()
    .default(false),
  consentFollowees: integer("consent_followees", { mode: "boolean" })
    .notNull()
    .default(false),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type UserProfileRow = InferSelectModel<typeof userProfiles>;
