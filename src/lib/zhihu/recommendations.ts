// 知乎问题推荐 API（GET /api/v1/user/question_recommendations）：
// 画像模式（不传 Query）按 Access Secret 所属账号画像推荐——「全站每日一题」的选题源。
// 注意：画像模式无法按登录用户个性化（文档明确按 Access Secret 所属账号），
// 按用户的个性化在法庭里走「同题 + 个性化演绎」，不在这里。
// 与本人全文等共用 creator 组额度（默认 100/日）→ 结果按 UTC 天缓存，一天最多取一次。

import { zhihuHeaders } from "./client";

const RECO_ENDPOINT =
  "https://developer.zhihu.com/api/v1/user/question_recommendations";

export interface RecoQuestion {
  title: string;
  url: string;
}

const dayCache = new Map<string, { items: RecoQuestion[] | null; expiresAt: number }>();
let inFlight: Promise<RecoQuestion[]> | null = null;

// UTC 天键，与法庭 caseId、剧场热榜的「一天一取」口径一致
export function zhihuUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfDayMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

async function rawRecommend(count: number): Promise<RecoQuestion[] | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${RECO_ENDPOINT}?Count=${count}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Data?: { Items?: Array<{ Title?: string; Url?: string }> };
    };
    const items: RecoQuestion[] = [];
    for (const raw of data.Data?.Items ?? []) {
      if (raw.Title && raw.Url) items.push({ title: raw.Title, url: raw.Url });
    }
    return items;
  } catch {
    return null;
  }
}

// 画像模式问题推荐。未配置密钥/失败/空结果返回 []，调用方回落本地案由池。
export async function fetchRecommendedQuestions(count = 5): Promise<RecoQuestion[]> {
  const n = Math.max(1, Math.min(20, count));
  const key = `${zhihuUtcDay()}|${n}`;
  const cached = dayCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.items ?? [];
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const items = await rawRecommend(n);
      const ok = items != null && items.length > 0;
      dayCache.set(key, {
        items: ok ? items : null,
        // 成功缓存到当天结束；失败走 30 分钟负缓存，避免猛打接口
        expiresAt: ok ? endOfDayMs() : Date.now() + 30 * 60 * 1000,
      });
      return items ?? [];
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
