// 知乎问题回答摘要 API（GET /api/v1/content/question_answers）：
// 法庭「论据战」的证据源——返回真实回答的服务端摘要与链接。
// 注意：Item 不含赞同数字段（http-api.md 明确只有 ContentType/ContentToken/Url/Summary），
// 「高赞」标注由调用方用一次站内搜索交叉匹配补充。
// 独立额度（默认 100/日）→ 按 QuestionUrl 当日缓存，同一问题一天只拉一次。

import { zhihuHeaders } from "./client";

const QA_ENDPOINT = "https://developer.zhihu.com/api/v1/content/question_answers";

export interface AnswerSummary {
  url: string;
  summary: string;
}

const dayCache = new Map<string, { items: AnswerSummary[] | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<AnswerSummary[]>>();

function endOfDayMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

// 有效性粗筛：无效或无摘要的回答会被服务端过滤，这里再拦一道空摘要
function isValidQuestionUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?zhihu\.com\/question\/\d+/.test(url);
}

async function rawFetch(questionUrl: string, limit: number): Promise<AnswerSummary[] | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(
      `${QA_ENDPOINT}?QuestionUrl=${encodeURIComponent(questionUrl)}&Limit=${limit}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Data?: { Items?: Array<{ Url?: string; Summary?: string }> };
    };
    const items: AnswerSummary[] = [];
    for (const raw of data.Data?.Items ?? []) {
      if (raw.Url && typeof raw.Summary === "string" && raw.Summary.trim()) {
        items.push({ url: raw.Url, summary: raw.Summary.trim() });
      }
    }
    return items;
  } catch {
    return null;
  }
}

// 拉取某问题下的回答摘要（按 URL 当日缓存）。失败/无密钥返回 []，调用方降级。
export async function fetchQuestionAnswers(
  questionUrl: string,
  limit = 20,
): Promise<AnswerSummary[]> {
  if (!isValidQuestionUrl(questionUrl)) return [];
  const n = Math.max(1, Math.min(50, limit));
  const key = `${questionUrl}|${n}`;
  const cached = dayCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.items ?? [];

  const running = inFlight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const items = await rawFetch(questionUrl, n);
      const ok = items != null && items.length > 0;
      dayCache.set(key, {
        items: ok ? items : null,
        // 成功缓存到当天结束；失败 30 分钟负缓存（当天晚些还能重试成功）
        expiresAt: ok ? endOfDayMs() : Date.now() + 30 * 60 * 1000,
      });
      return items ?? [];
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}
