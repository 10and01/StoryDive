// 用户画像领域类型：知乎授权数据经 AI 提炼后的结构化结果。
// 只存提炼结果，不存回答原文（token 1 小时过期无刷新，画像在 D1 里长期可用）。

/** AI 提炼的结构化画像 */
export interface UserProfile {
  /** 兴趣关键词（3-6 个，具体化，如「循环悬疑」而非「小说」） */
  keywords: string[];
  /** 兴趣领域短语（2-4 个） */
  interests: string[];
  /** 表达偏好一句话（理性/感性/玩梗…） */
  tone: string;
  /** 一句话画像（30 字内） */
  summary: string;
}

/** 判例卡：用户自己的知乎创作（标题+摘要+赞同数+链接），对戏/法庭的引用素材 */
export interface UserContentCard {
  title: string;
  summary: string;
  url: string;
  likeCount: number;
  type: string; // answer / article / pin …
  createdAt: number; // 秒级时间戳
}

/** 影子卡：关注的人的公开资料，影子 NPC 演绎素材 */
export interface FolloweeCard {
  name: string;
  headline: string;
  url: string;
  avatarUrl?: string;
  followerCount: number;
}

/** /api/user/sync 的响应（前端据此提示成功/需重新授权） */
export interface SyncResult {
  ok: boolean;
  code?: "reauth_needed" | "no_oauth" | "empty" | "ai_failed";
  profile?: UserProfile;
  cards?: number;
  syncedAt?: string;
}
