import type { HotTopic } from "./types";

// 知乎开放平台·热榜接入（https://developer.zhihu.com/api/v1/content/hot_list）
// + 应用层缓存。热榜额度有限且一天内变化很小，因此做「一天一取」：
// 进程内内存缓存 + 并发去重 + 失败短缓存，把真实请求压到「每天最多一次」。

const DAY_MS = 24 * 3600 * 1000;
// 失败/无结果时的负缓存时长：避免反复重试猛打接口，又能在较短时间后自动恢复。
const NEGATIVE_TTL_MS = 30 * 60 * 1000;
// 每日确定轮换的候选池大小：同一天内所有访问者看到同一条，跨天轮换。
const DAILY_POOL_SIZE = 5;

const HOTLIST_ENDPOINT = "https://developer.zhihu.com/api/v1/content/hot_list";

interface ZhihuHotItem {
  Title?: string;
  Url?: string;
  ThumbnailUrl?: string;
  Summary?: string;
}

interface CacheEntry {
  dayKey: string; // 命中判定用的自然日 key（本地时区 YYYY-MM-DD）
  items: HotTopic[] | null; // null 表示上次拉取失败（负缓存）
  expiresAt: number;
}

// 进程级缓存与「进行中」的请求（并发去重）。
let cache: CacheEntry | null = null;
let inFlight: Promise<HotTopic[] | null> | null = null;

function dayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 伪随机但按日确定：同一天内取到的话题稳定，跨天自然轮换。
function dailyPick<T>(items: T[], poolSize: number, key = dayKey()): T | undefined {
  if (items.length === 0) return undefined;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pool = items.slice(0, Math.max(1, Math.min(poolSize, items.length)));
  return pool[Math.abs(h) % pool.length];
}

function toItem(item: ZhihuHotItem, index: number): HotTopic | null {
  if (!item.Title) return null;
  return {
    id: `hot-${dayKey()}-${index}`,
    title: item.Title,
    angle:
      item.Summary?.trim() ||
      "把这个热榜话题里最戏剧化的两难时刻，撕开给读者选。",
    tags: ["热榜", "实时"],
    url: item.Url,
    cover: item.ThumbnailUrl || undefined,
  };
}

// 真正打知乎热榜接口（未配置 Access Secret 则返回 null）。带 revalidate 作为二级防线。
async function rawFetch(): Promise<HotTopic[] | null> {
  const secret = process.env.ZHIHU_ACCESS_SECRET;
  if (!secret) return null;

  try {
    const res = await fetch(`${HOTLIST_ENDPOINT}?Limit=30`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Data?: { Items?: ZhihuHotItem[] } };
    const items = (data.Data?.Items ?? [])
      .map(toItem)
      .filter((x): x is HotTopic => x !== null);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

async function fetchHotItems(): Promise<HotTopic[] | null> {
  const now = Date.now();
  const today = dayKey();

  // 1) 命中当日有效缓存（成功的当天缓存，或未过期的负缓存）
  if (cache && cache.dayKey === today && cache.expiresAt > now) {
    return cache.items;
  }

  // 2) 已有进行中的请求：并发去重，直接复用同一个 promise
  if (inFlight) return inFlight;

  // 3) 发起唯一一次真实请求，落缓存后清空 in-flight
  inFlight = (async () => {
    try {
      const items = await rawFetch();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      cache = {
        dayKey: today,
        items,
        // 成功则缓存到当天结束；失败/无结果走较短的负缓存，稍后自动重试
        expiresAt:
          items != null
            ? Math.min(endOfDay.getTime(), now + DAY_MS)
            : now + NEGATIVE_TTL_MS,
      };
      return items;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// 对外入口：当日热榜话题。未配置密钥或拉取失败时返回 null，
// 调用方降级到本地话题池，Demo 永不空场。
export async function fetchHotTopic(): Promise<HotTopic | null> {
  const items = await fetchHotItems();
  return dailyPick(items ?? [], DAILY_POOL_SIZE) ?? null;
}

// 当日热榜完整候选池（Top N），供需要多条热榜的功能使用。
export async function fetchHotTopics(limit = 10): Promise<HotTopic[]> {
  const items = (await fetchHotItems()) ?? [];
  return items.slice(0, limit);
}

// 仅供测试/手动运维：清空缓存，强制下次重新拉取。
export function __clearHotlistCache(): void {
  cache = null;
  inFlight = null;
}
