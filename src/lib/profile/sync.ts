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
  fetchUserCollections,
  fetchZhihuUserBrief,
  type UserContentItem,
  type UserCollectionItem,
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

// 把收藏条目收敛成判例卡（collected=true：引用口吻用「你收藏过」）。
export function toCollectionCards(items: UserCollectionItem[]): UserContentCard[] {
  return items
    .filter((it) => it.title)
    .map((it) => ({
      title: it.title,
      summary: it.summary,
      url: it.url,
      likeCount: it.likeCount,
      type: it.contentType,
      createdAt: it.favTime,
      collected: true,
    }));
}

const PROFILE_SYSTEM_PROMPT = `你是「入局」的用户画像师。根据一位知乎用户的创作/收藏列表（标题+摘要+赞同数，可能附一句个人签名），提炼一份用于个性化叙事体验的兴趣画像。
只输出一个 JSON 对象，不要 markdown 围栏，不要解释：
{"keywords": ["3-6个具体兴趣关键词"], "interests": ["2-4个兴趣领域短语"], "tone": "一句话表达偏好", "summary": "一句话画像，30字以内"}
要求：
- 只从列表与签名内容归纳，不臆测身份、职业、住址等隐私。
- 关键词要具体可感（如「循环悬疑」「职场立威」而非「小说」「职场」）。
- tone 描述这个人说话的味儿（如「冷静爱拆因果」「热忱爱举身边例子」）。
- 收藏的内容反映兴趣倾向，创作的反映表达方式；没有创作只有收藏时，画像侧重兴趣。
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

// 从判例卡（+可选的知乎签名）提炼画像。素材太少或 AI 失败返回 null。
export async function distillProfile(
  cards: UserContentCard[],
  userBrief?: string,
): Promise<UserProfile | null> {
  if (cards.length === 0 && !userBrief) return null;
  const lines = cards
    .slice(0, 20)
    .map(
      (c, i) =>
        `${i + 1}. ${c.collected ? "[收藏]" : "[创作]"} ${c.title}（赞同 ${c.likeCount}）${c.summary ? `：${c.summary.slice(0, 80)}` : ""}`,
    )
    .join("\n");
  const brief = userBrief ? `\nTA 的知乎签名/简介：${userBrief.slice(0, 120)}` : "";
  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: PROFILE_SYSTEM_PROMPT },
        { role: "user", content: `创作/收藏列表：\n${lines || "（无）"}${brief}` },
      ],
      temperature: 0.5,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return sanitizeProfile(extractJson(text));
  } catch {
    return null;
  }
}

// 完整同步（冷启动链）：创作列表 → 不够 3 条时补近期收藏 → 再补知乎签名。
// 三层都空才是真正的空账号。鉴权失败向上抛 ZhihuAuthError；其余失败降级。
export async function syncProfileFromZhihu(
  oauthToken: string,
): Promise<{ profile: UserProfile | null; cards: UserContentCard[] }> {
  const items = await fetchUserContents(oauthToken, {
    contentType: "answer",
    sortField: "like_count",
    limit: 20,
  });
  let cards = toContentCards(items);

  // 冷启动第一层：创作不足时用近期收藏补位（收藏的内容同样反映兴趣）
  if (cards.length < 3) {
    try {
      const collections = await fetchUserCollections(oauthToken, 20);
      const collected = toCollectionCards(collections).filter(
        (c) => !cards.some((own) => own.url === c.url),
      );
      cards = [...cards, ...collected];
    } catch {
      // 收藏拉取失败不拦同步
    }
  }

  // 冷启动第二层：知乎签名/简介（headline/description）作为画像底色
  let userBrief: string | undefined;
  try {
    const brief = await fetchZhihuUserBrief(oauthToken);
    if (brief) userBrief = [brief.headline, brief.description].filter(Boolean).join("；");
  } catch {
    // 签名读取失败不拦同步
  }

  const profile = await distillProfile(cards, userBrief);
  return { profile, cards };
}
