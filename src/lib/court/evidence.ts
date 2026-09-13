// 论据战证据管线：真实知乎回答 → 情感/数据双池 → 注入辩手 prompt。
// 两条来源路径：
// - 推荐案由（有真实问题 URL）：question_answers 回答摘要为主池，
//   一次站内搜索交叉标注赞同数（question_answers 不含赞同数字段）；
// - 本地案由池（无问题 URL）：直接站内搜索案由关键词，命中回答即证据。
// 空池是常态兜底：调用方降级为无论据的普通庭审，不空场。

import { fetchQuestionAnswers } from "@/lib/zhihu/question-answers";
import { zhihuSearch } from "@/lib/zhihu/search";
import type { EvidenceItem } from "./types";

const DATA_HINTS = [
  "数据", "统计", "研究", "调查", "报告", "实验", "概率", "成本", "效率", "收益",
  "逻辑", "规律", "结论", "分析", "对比", "占比", "增长", "模型", "科学", "事实",
  "证据", "测算", "量化", "第一", "其次", "总之", "率", "机制", "原理", "风险", "权衡",
];
const EMOTION_HINTS = [
  "妈妈", "爸爸", "外婆", "奶奶", "爷爷", "朋友", "爱", "哭", "泪", "难过", "心疼",
  "遗憾", "故事", "经历", "那年", "那一刻", "后来", "感受", "孤独", "温柔", "拥抱",
  "心跳", "喜欢", "后悔", "青春", "家", "梦想", "真心", "想你", "他", "她", "我",
];

function classify(text: string): "emotion" | "logic" {
  let data = 0;
  let emo = 0;
  for (const k of DATA_HINTS) if (text.includes(k)) data += 1;
  for (const k of EMOTION_HINTS) if (text.includes(k)) emo += 1;
  return data > emo ? "logic" : "emotion";
}

function toEvidence(texts: { summary: string; url: string; voteUpCount?: number }[]): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const t of texts) {
    const summary = t.summary.trim();
    if (summary.length < 15) continue; // 太短的摘要撑不起论据
    out.push({
      n: out.length + 1,
      url: t.url,
      summary: summary.slice(0, 160),
      voteUpCount: t.voteUpCount,
      kind: classify(summary),
    });
  }
  return out;
}

function splitPools(all: EvidenceItem[]): { emotion: EvidenceItem[]; logic: EvidenceItem[] } {
  let emotion = all.filter((e) => e.kind === "emotion").slice(0, 4);
  let logic = all.filter((e) => e.kind === "logic").slice(0, 4);
  // 一侧空池时向对侧借两条：数据向的回答照样能被故事党拿来说
  // 「连高赞都在算账，可账算不清心动」——真实材料比空池好用。
  if (emotion.length === 0) emotion = logic.slice(0, 2);
  if (logic.length === 0) logic = emotion.slice(0, 2);
  return { emotion, logic };
}

export interface EvidencePool {
  all: EvidenceItem[]; // 全局编号证据池（前端渲染 [n] chip 用）
  emotion: EvidenceItem[]; // 烈盐（故事党）池
  logic: EvidenceItem[]; // 析盐（逻辑党）池
}

export const EMPTY_EVIDENCE: EvidencePool = { all: [], emotion: [], logic: [] };

// 路径一：推荐案由（真实问题 URL）→ 回答摘要池 + 搜索交叉标注赞同数。
export async function buildEvidenceFromQuestion(
  questionUrl: string,
  topic: string,
): Promise<EvidencePool> {
  const answers = await fetchQuestionAnswers(questionUrl, 20);
  if (answers.length === 0) return EMPTY_EVIDENCE;
  // 一次站内搜索（10 分钟缓存）只为交叉赞同数；失败不拦证据池
  const hits = await zhihuSearch(topic.slice(0, 80), 10);
  const votesByUrl = new Map<string, number>();
  for (const h of hits) votesByUrl.set(h.url, h.voteUpCount);
  const all = toEvidence(
    answers.map((a) => ({ summary: a.summary, url: a.url, voteUpCount: votesByUrl.get(a.url) })),
  );
  if (all.length === 0) return EMPTY_EVIDENCE;
  const { emotion, logic } = splitPools(all);
  return { all, emotion, logic };
}

// 路径二：本地案由池（无真实问题 URL）→ 站内搜索案由关键词当证据。
export async function buildEvidenceFromSearch(topic: string): Promise<EvidencePool> {
  const hits = await zhihuSearch(topic.slice(0, 80), 8);
  if (hits.length === 0) return EMPTY_EVIDENCE;
  const all = toEvidence(
    hits.map((h) => ({ summary: h.contentText, url: h.url, voteUpCount: h.voteUpCount })),
  );
  if (all.length === 0) return EMPTY_EVIDENCE;
  const { emotion, logic } = splitPools(all);
  return { all, emotion, logic };
}

// 渲染进辩手 prompt 的证据块：只准引用给出的 [编号]，绝不编造（纪律同刘看山）。
export function evidenceBlock(pool: EvidencePool, side: "red" | "blue"): string {
  const items = side === "red" ? pool.emotion : pool.logic;
  if (items.length === 0) return "";
  const who = side === "red" ? "烈盐" : "析盐";
  const lines = items
    .map(
      (e) =>
        `[${e.n}] ${e.summary}${typeof e.voteUpCount === "number" && e.voteUpCount > 0 ? `（知乎赞同 ${e.voteUpCount}）` : ""}`,
    )
    .join("\n");
  return `
【现场证物——知乎真实回答摘录】
${lines}

引用纪律（必须遵守）：
- 上面是从本案话题下检索到的真实知乎回答，只准引用给出的编号，绝不编造编号或内容。
- 你的发言里至少自然化用 1 条证据，在句中或句末标注 [编号]，让旁听席可以点开验证。
- 证据为你所用：${who === "烈盐" ? "从回答里读出人的心跳，把它变成共情的弹药" : "从回答里抽出可复现的事实与数据，把它变成逻辑的钉子"}。`;
}
