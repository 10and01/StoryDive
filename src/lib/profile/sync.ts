// 画像同步管线：用户知乎创作列表 → AI 提炼结构化画像 → D1 缓存。
// 设计要点：
// - OAuth token 1 小时过期无刷新 → 同步在用户主动触发时进行，结果落 D1 长期可用；
//   token 失效抛 ZhihuAuthError，路由返回 reauth_needed，前端引导重新授权。
// - 只存提炼结果与判例卡（标题+摘要），不存回答原文与 token。
// - AI 失败不拦判例卡入库（画像可为空，判例与证据引用仍可用）。

import { appAi } from "@/lib/ai-client";
import { extractJson } from "@/lib/court/parse";
import {
  fetchUserContents,
  type UserContentItem,
  type FolloweeItem,
} from "@/lib/zhihu/user-data";
import type { FolloweeCard, UserContentCard, UserProfile } from "./types";

// 把 API 原始条目收敛成判例卡（标题+摘要+赞同数+链接）。
export function toContentCards(items: UserContentItem[]): UserContentCard[] {
  return items
    .filter((it) => it.title || it.summary)
    .map((it) => ({
      title: it.title || it.summary.slice(0, 30),
      summary: it.summary,
      url: it.url,
      likeCount: it.likeCount,
      type: it.contentType,
      createdAt: it.createdAt,
    }));
}

// 把关注列表收敛成影子卡（仅公开资料：昵称+一句话介绍+头像）。
export function toFolloweeCards(items: FolloweeItem[]): FolloweeCard[] {
  return items
    .filter((it) => it.fullname)
    .map((it) => ({
      name: it.fullname.slice(0, 30),
      headline: it.headline.slice(0, 60),
      url: it.url,
      avatarUrl: it.avatarUrl,
      followerCount: it.followerCount,
    }));
}

const PROFILE_SYSTEM_PROMPT = `你是「入局」的用户画像师。根据一位知乎用户的高赞创作列表（标题+摘要+赞同数），提炼一份用于个性化叙事体验的兴趣画像。
只输出一个 JSON 对象，不要 markdown 围栏，不要解释：
{"keywords": ["3-6个具体兴趣关键词"], "interests": ["2-4个兴趣领域短语"], "tone": "一句话表达偏好", "summary": "一句话画像，30字以内"}
要求：
- 只从列表内容归纳，不臆测身份、职业、住址等隐私。
- 关键词要具体可感（如「循环悬疑」「职场立威」而非「小说」「职场」）。
- tone 描述这个人说话的味儿（如「冷静爱拆因果」「热忱爱举身边例子」）。
- 全部简体中文。`;

function sanitizeProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, max)
      : [];
  const keywords = arr(o.keywords, 6);
  const interests = arr(o.interests, 4);
  const tone = typeof o.tone === "string" ? o.tone.trim().slice(0, 40) : "";
  const summary = typeof o.summary === "string" ? o.summary.trim().slice(0, 60) : "";
  if (keywords.length === 0 && !summary) return null;
  return { keywords, interests, tone, summary };
}

// 从判例卡提炼画像。内容太少（<2 条）或 AI 失败返回 null（调用方仍可入库判例卡）。
export async function distillProfile(cards: UserContentCard[]): Promise<UserProfile | null> {
  if (cards.length < 2) return null;
  const lines = cards
    .slice(0, 20)
    .map(
      (c, i) =>
        `${i + 1}. ${c.title}（赞同 ${c.likeCount}）${c.summary ? `：${c.summary.slice(0, 80)}` : ""}`,
    )
    .join("\n");
  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: PROFILE_SYSTEM_PROMPT },
        { role: "user", content: `创作列表：\n${lines}` },
      ],
      temperature: 0.5,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return sanitizeProfile(extractJson(text));
  } catch {
    return null;
  }
}

// 完整同步：拉创作列表（按赞同数取 20 条回答）→ 判例卡 + 画像。
// 鉴权失败向上抛 ZhihuAuthError；其余失败降级返回尽可能多的成果。
export async function syncProfileFromZhihu(
  oauthToken: string,
): Promise<{ profile: UserProfile | null; cards: UserContentCard[] }> {
  const items = await fetchUserContents(oauthToken, {
    contentType: "answer",
    sortField: "like_count",
    limit: 20,
  });
  const cards = toContentCards(items);
  const profile = cards.length >= 2 ? await distillProfile(cards) : null;
  return { profile, cards };
}
