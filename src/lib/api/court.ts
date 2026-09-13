import { request } from "./request";
import type { CourtDuel, CourtProfile, Side } from "@/lib/court/types";

export type { CourtDuel, CourtProfile, Side };
export type CourtTally = {
  red: number;
  blue: number;
  mine: "red" | "blue" | null;
};

// 开一局双 Agent 对抗庭：盐官陈词 + 烈盐/析盐立论（难度由观众画像自适应）。
export async function openDuel(seed?: number): Promise<{
  case: CourtDuel;
  profile: CourtProfile | null;
  fallback?: boolean;
}> {
  const res = await request("/api/court/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(typeof seed === "number" ? { seed } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    case: CourtDuel;
    profile: CourtProfile | null;
    fallback?: boolean;
  };
  return data;
}

// 单回合单方发言：transcript 由客户端持有并回传（服务端无状态）。
export async function rebutDuel(input: {
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
