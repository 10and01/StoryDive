// 全站每日一题解析链（「同题+个性化演绎」的辩题来源）：
// 1) D1 court_cases 当日行（含证据池缓存）→ 直接用；
// 2) 知乎画像模式推荐（question_recommendations，一天一次）→ 按天哈希取一题
//    → AI 改写红蓝案由 → 证据池（question_answers + 搜索交叉标注）→ 落库；
// 3) 推荐不可用（无密钥/额度尽/空结果）→ 本地案由池按天哈希 → 搜索证据 → 落库；
// 4) 全链失败 → 本地案由池 + 空证据，永不空场。
// 所有环节失败都不抛异常——解析链自身就是兜底链。

import { appAi } from "@/lib/ai-client";
import { extractJson } from "@/lib/court/parse";
import {
  buildEvidenceFromQuestion,
  buildEvidenceFromSearch,
  EMPTY_EVIDENCE,
  type EvidencePool,
} from "@/lib/court/evidence";
import { pickCase, COURT_CASE_POOL, type CourtCaseSeed } from "@/lib/court/types";
import {
  getDailyCaseRow,
  upsertDailyCase,
} from "@/lib/db/queries/court";
import { fetchRecommendedQuestions, zhihuUtcDay } from "@/lib/zhihu/recommendations";
import { hasZhihuSecret } from "@/lib/zhihu/client";

export interface DailyCase extends CourtCaseSeed {
  source: "recommended" | "pool";
  questionUrl?: string;
  evidence: EvidencePool;
  caseId: string;
}

const REWRITE_SYSTEM_PROMPT = `你是盐灵，名场面法庭的选题官。下面是一个真实的知乎问题，把它改写成红蓝两造对赌的法庭案由。
只输出一个 JSON 对象，不要 markdown 围栏，不要解释：
{"caseTitle": "案由标题，保留原问题的两难张力，25字以内", "brief": "案情简述，2-3句，交代两难", "redAngle": "红方改写方向一句话（共情/故事/人的处境）", "blueAngle": "蓝方改写方向一句话（逻辑/数据/规则）", "tags": ["2-4个题材标签"]}
要求：红方天然代表情感与处境，蓝方天然代表逻辑与规则，两边都站得住、真对立；全部简体中文。`;

// 按天哈希：同一天全站稳定取同一个（推荐题/池子题都适用）
function dayHash(day: string, salt: string): number {
  let h = 0;
  const s = `${day}|${salt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function sanitizeRewrite(raw: unknown): Omit<CourtCaseSeed, "id"> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, max: number): string =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
  const caseTitle = str(o.caseTitle, 60);
  const brief = str(o.brief, 300);
  const redAngle = str(o.redAngle, 120);
  const blueAngle = str(o.blueAngle, 120);
  if (!caseTitle || !brief || !redAngle || !blueAngle) return null;
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 4)
    : [];
  return { caseTitle, brief, redAngle, blueAngle, tags };
}

// 当日缓存行 → DailyCase（证据为空且有问题 URL 时可重建证据）。
function rowToDailyCase(row: {
  date: string;
  caseId: string;
  source: string;
  questionUrl: string | null;
  caseTitle: string;
  brief: string | null;
  redAngle: string | null;
  blueAngle: string | null;
  tagsJson: string | null;
  evidenceJson: string | null;
}): DailyCase {
  let evidence: EvidencePool = EMPTY_EVIDENCE;
  if (row.evidenceJson) {
    try {
      const parsed = JSON.parse(row.evidenceJson) as EvidencePool;
      if (parsed && Array.isArray(parsed.all)) evidence = parsed;
    } catch {
      // 证据 JSON 损坏 → 空池，下次解析链会尝试重建
    }
  }
  let tags: string[] = [];
  try {
    const t = row.tagsJson ? (JSON.parse(row.tagsJson) as unknown) : [];
    if (Array.isArray(t)) tags = t.filter((x): x is string => typeof x === "string");
  } catch {
    // tags 只是增强项，损坏可忽略
  }
  return {
    id: row.caseId,
    caseId: row.caseId,
    caseTitle: row.caseTitle,
    brief: row.brief ?? "",
    redAngle: row.redAngle ?? "",
    blueAngle: row.blueAngle ?? "",
    tags,
    source: row.source === "recommended" ? "recommended" : "pool",
    questionUrl: row.questionUrl ?? undefined,
    evidence,
  };
}

// 解析当日全站辩题。永不抛异常：任何环节失败都降级到本地案由池。
export async function resolveDailyCase(): Promise<DailyCase> {
  const day = zhihuUtcDay();

  // 1) 当日缓存
  const row = await getDailyCaseRow(day);
  if (row) {
    const daily = rowToDailyCase(row);
    // 案由已缓存但证据为空（当天首建时接口抖动）→ 静默重建，不拦开庭
    if (daily.evidence.all.length === 0) {
      const evidence = daily.questionUrl
        ? await buildEvidenceFromQuestion(daily.questionUrl, daily.caseTitle)
        : await buildEvidenceFromSearch(daily.caseTitle);
      if (evidence.all.length > 0) {
        daily.evidence = evidence;
        void upsertDailyCase({
          date: day,
          caseId: daily.caseId,
          source: daily.source,
          questionUrl: daily.questionUrl ?? null,
          caseTitle: daily.caseTitle,
          brief: daily.brief,
          redAngle: daily.redAngle,
          blueAngle: daily.blueAngle,
          tagsJson: JSON.stringify(daily.tags),
          evidenceJson: JSON.stringify(evidence),
        }).catch(() => undefined);
      }
    }
    return daily;
  }

  // 2) 知乎画像模式推荐 → AI 改写
  if (hasZhihuSecret()) {
    try {
      const recos = await fetchRecommendedQuestions(5);
      if (recos.length > 0) {
        const picked = recos[dayHash(day, "reco") % recos.length];
        const result = await appAi.chat({
          messages: [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            { role: "user", content: `真实知乎问题：${picked.title}` },
          ],
          temperature: 0.7,
        });
        const seed = sanitizeRewrite(extractJson(result.choices?.[0]?.message?.content ?? ""));
        if (seed) {
          const caseId = `zq-${day}`;
          const evidence = await buildEvidenceFromQuestion(picked.url, seed.caseTitle);
          const daily: DailyCase = {
            ...seed,
            id: caseId,
            caseId,
            source: "recommended",
            questionUrl: picked.url,
            evidence,
          };
          void upsertDailyCase({
            date: day,
            caseId,
            source: daily.source,
            questionUrl: picked.url,
            caseTitle: daily.caseTitle,
            brief: daily.brief,
            redAngle: daily.redAngle,
            blueAngle: daily.blueAngle,
            tagsJson: JSON.stringify(daily.tags),
            evidenceJson: evidence.all.length ? JSON.stringify(evidence) : null,
          }).catch(() => undefined);
          return daily;
        }
      }
    } catch (error) {
      console.error("[court/daily-case] recommended path failed:", error);
    }
  }

  // 3) 本地案由池兜底（搜索证据尽力而为）
  return poolCaseOfDay(day);
}

// 本地案由池的当日题（推荐不可用/解析链失败时的稳定兜底）。
export async function poolCaseOfDay(day: string): Promise<DailyCase> {
  const seed = pickCase(dayHash(day, "pool"));
  const caseId = `${seed.id}-${day}`;
  const daily: DailyCase = {
    ...seed,
    id: caseId,
    caseId,
    source: "pool",
    evidence: EMPTY_EVIDENCE,
  };
  try {
    const evidence = await buildEvidenceFromSearch(seed.caseTitle);
    if (evidence.all.length > 0) daily.evidence = evidence;
  } catch {
    // 证据失败 → 空池普通庭
  }
  void upsertDailyCase({
    date: day,
    caseId,
    source: "pool",
    caseTitle: seed.caseTitle,
    brief: seed.brief,
    redAngle: seed.redAngle,
    blueAngle: seed.blueAngle,
    tagsJson: JSON.stringify(seed.tags),
    evidenceJson: daily.evidence.all.length ? JSON.stringify(daily.evidence) : null,
  }).catch(() => undefined);
  return daily;
}

// 「换一桩」：跳过每日一题，从案由池现取另一桩名场面/话题开庭。
// caseId 用池内稳定 id（不带日期后缀）——票仓跨天全站聚合，不会碎片化；
// 不落 court_cases（该表按天主键，写会覆盖当日题），回合辩驳因此不带
// 服务端证据注入，庭审内的证据展示不受影响。
// excludeCaseId 传当前案的完整 caseId（如 zq-2026-09-14 / ak47-scene-2026-09-14），
// 剥掉日期后缀得到池内 id 用于排除，避免换到同一个。
export async function poolCaseReroll(excludeCaseId?: string): Promise<DailyCase> {
  const excludeSeedId = excludeCaseId?.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const candidates = COURT_CASE_POOL.filter((s) => s.id !== excludeSeedId);
  const seed =
    candidates[Math.floor(Math.random() * candidates.length)] ?? COURT_CASE_POOL[0];
  const daily: DailyCase = {
    ...seed,
    id: seed.id,
    caseId: seed.id,
    source: "pool",
    evidence: EMPTY_EVIDENCE,
  };
  try {
    const evidence = await buildEvidenceFromSearch(seed.caseTitle);
    if (evidence.all.length > 0) daily.evidence = evidence;
  } catch {
    // 证据失败 → 空池普通庭
  }
  return daily;
}
