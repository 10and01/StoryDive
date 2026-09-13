// 知乎站内搜索 API（GET /api/v1/content/zhihu_search）：
// NPC 与刘看山「引用真实高赞回答」的素材来源，返回真实回答的标题/摘要/赞同数/链接。
// 日额度有限 → query 键缓存 + in-flight 并发去重 + 失败负缓存（模式同 hotlist.ts）。

import { zhihuHeaders } from "./client";

const SEARCH_ENDPOINT = "https://developer.zhihu.com/api/v1/content/zhihu_search";
const POSITIVE_TTL_MS = 10 * 60 * 1000; // 搜索结果短期内稳定，命中缓存 10 分钟
const NEGATIVE_TTL_MS = 60 * 1000; // 失败/空结果走短负缓存，避免猛打接口
const MAX_COUNT = 10; // 服务端上限
const CACHE_LIMIT = 200; // 进程内缓存条目上限，超出丢弃最早条目

export interface ZhihuSearchHit {
  n: number; // 引用编号（从 1 起），与注入 prompt 的 [n] 标注对应
  title: string;
  contentText: string; // 摘要（已清洗 <em> 高亮标签）
  url: string; // 真实知乎链接（带平台溯源 UTM）
  voteUpCount: number;
  authorName: string;
  authorAvatar?: string;
  contentType: string; // 回答 / 文章
}

interface RawItem {
  Title?: string;
  ContentType?: string;
  ContentText?: string;
  Url?: string;
  VoteUpCount?: number;
  AuthorName?: string;
  AuthorAvatar?: string;
}

const cache = new Map<string, { hits: ZhihuSearchHit[] | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<ZhihuSearchHit[]>>();

function stripEm(text: string): string {
  return text.replace(/<\/?em>/g, "").trim();
}

function normalizeKey(query: string, count: number): string {
  return `${query.replace(/\s+/g, " ").trim()}|${count}`;
}

async function rawSearch(query: string, count: number): Promise<ZhihuSearchHit[] | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(
      `${SEARCH_ENDPOINT}?Query=${encodeURIComponent(query)}&Count=${count}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Data?: { Items?: RawItem[] } };
    const hits: ZhihuSearchHit[] = [];
    for (const raw of data.Data?.Items ?? []) {
      if (!raw.Title || !raw.Url) continue;
      hits.push({
        n: hits.length + 1,
        title: raw.Title,
        contentText: stripEm(raw.ContentText ?? ""),
        url: raw.Url,
        voteUpCount: typeof raw.VoteUpCount === "number" ? raw.VoteUpCount : 0,
        authorName: raw.AuthorName || "知乎用户",
        authorAvatar: raw.AuthorAvatar || undefined,
        contentType: raw.ContentType || "回答",
      });
    }
    return hits;
  } catch {
    return null;
  }
}

// 站内搜索。未配置密钥、失败或无结果时返回 []，调用方据此降级为不引用的纯角色戏。
export async function zhihuSearch(query: string, count = 5): Promise<ZhihuSearchHit[]> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q) return [];
  const n = Math.max(1, Math.min(MAX_COUNT, count));
  const key = normalizeKey(q, n);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.hits ?? [];

  const running = inFlight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const hits = await rawSearch(q, n);
      const ok = hits != null && hits.length > 0;
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, {
        hits: ok ? hits : null,
        expiresAt: Date.now() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
      });
      return hits ?? [];
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}

// 仅供测试/运维：清空缓存。
export function __clearZhihuSearchCache(): void {
  cache.clear();
  inFlight.clear();
}
