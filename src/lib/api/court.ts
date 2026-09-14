import { request } from "./request";
import type { CourtDuel, CourtProfile, Side } from "@/lib/court/types";
import type { ZhihuCitation } from "./zhihu-citation";

export type { CourtDuel, CourtProfile, Side };
export type { ZhihuCitation };
export type CourtTally = {
  red: number;
  blue: number;
  mine: "red" | "blue" | null;
};

// 开一局双 Agent 对抗庭：辩题由服务端按「全站每日一题」解析（知乎画像推荐 →
// 本地池兜底），个性化在演绎层（观众画像 + 证据池）。
// opts.reroll = true 为「换一桩」：跳过每日一题，从案由池现取另一桩开庭
// （excludeCaseId 传当前案完整 caseId，避免换到同一个）。
export async function openDuel(
  opts?: { seed?: number; reroll?: boolean; excludeCaseId?: string },
): Promise<{
  case: CourtDuel;
  profile: CourtProfile | null;
  fallback?: boolean;
}> {
  const res = await request("/api/court/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(typeof opts?.seed === "number" ? { seed: opts.seed } : {}),
      ...(opts?.reroll ? { reroll: true } : {}),
      ...(opts?.excludeCaseId ? { excludeCaseId: opts.excludeCaseId.slice(0, 64) } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    case: CourtDuel;
    profile: CourtProfile | null;
    fallback?: boolean;
  };
  return data;
}

// 单回合单方发言：transcript 由客户端持有并回传（服务端无状态）；
// 证据池由服务端按 caseId 持有，客户端只带 caseId。
export async function rebutDuel(input: {
  caseId?: string;
  caseTitle: string;
  brief: string;
  redHeadline: string;
  blueHeadline: string;
  transcript: { side: Side; text: string }[];
  side: Side;
  difficulty: number;
  roundNo: number;
  lean: Side | null;
}): Promise<{ text: string; fallback?: boolean }> {
  const res = await request("/api/court/rebut", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { text: string; fallback?: boolean };
}

// 看山「深挖这个问题」：真实回答的观点综述（[n] 引用可点开验证）。
export async function deepDiveQuestion(input: {
  questionUrl?: string;
  topic?: string;
}): Promise<{ reply: string; citations: ZhihuCitation[]; source?: string }> {
  const res = await request("/api/court/deepdive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { reply: string; citations: ZhihuCitation[]; source?: string };
}

// 读取某场票数（含我投的一方）。
export async function fetchTally(caseId: string): Promise<CourtTally> {
  const res = await request(`/api/court/vote?caseId=${encodeURIComponent(caseId)}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CourtTally;
}

// 投票 / 改投。
export async function castCourtVote(
  caseId: string,
  side: "red" | "blue",
): Promise<CourtTally> {
  const res = await request("/api/court/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, side }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CourtTally;
}

// 取盐官总评。
export async function fetchVerdict(input: {
  caseTitle: string;
  redHeadline: string;
  blueHeadline: string;
  redVotes: number;
  blueVotes: number;
}): Promise<string> {
  const res = await request("/api/court/verdict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { verdict: string };
  return data.verdict;
}

// 判决书 → 知乎原生想法文案（用户可编辑后复制/分享）。
export async function generateCourtIdea(input: {
  caseTitle: string;
  redHeadline: string;
  blueHeadline: string;
  redVotes: number;
  blueVotes: number;
  verdict: string;
}): Promise<string> {
  const res = await request("/api/court/idea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}
