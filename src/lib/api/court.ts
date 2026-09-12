import { request } from "./request";
import type { CourtCase } from "@/lib/court/types";

export interface CourtTally {
  red: number;
  blue: number;
  mine: "red" | "blue" | null;
}

// 开一场庭审（盐灵现生成红蓝两造）。
export async function fetchCourtCase(seed?: number): Promise<CourtCase> {
  const qs = typeof seed === "number" ? `?seed=${seed}` : "";
  const res = await request(`/api/court${qs}`, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { case: CourtCase };
  return data.case;
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
