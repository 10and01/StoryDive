import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { courtCases, courtVotes } from "../schema/court";
import type { CourtCaseRow } from "../schema/court";
import type { CourtProfile } from "@/lib/court/types";

export interface CourtTally {
  red: number;
  blue: number;
  mine: "red" | "blue" | null; // 当前用户投给了哪一方
}

// 观众历史画像：全部投票里红蓝分布 → 立场倾向与难度档。
// 0-2 票 → 1（初阶）；3-6 票 → 2（进阶）；≥7 票 → 3（高阶）。
// 偏向：≥3 票且某方占比 ≥60% 才算明显（驱动「针对你的立场下钩子」）。
export async function userCourtProfile(userId: string): Promise<CourtProfile> {
  const rows = await db
    .select({ side: courtVotes.side })
    .from(courtVotes)
    .where(eq(courtVotes.userId, userId));

  let red = 0;
  let blue = 0;
  for (const r of rows) {
    if (r.side === "red") red += 1;
    else if (r.side === "blue") blue += 1;
  }
  const total = red + blue;
  const redShare = total > 0 ? Math.round((red / total) * 100) : 50;
  const lean: CourtProfile["lean"] =
    total >= 3 && redShare >= 60
      ? "red"
      : total >= 3 && redShare <= 40
        ? "blue"
        : null;
  const difficulty: CourtProfile["difficulty"] = total >= 7 ? 3 : total >= 3 ? 2 : 1;
  return { totalVotes: total, red, blue, redShare, lean, difficulty };
}

// 统计某场庭审的红蓝票数，以及当前用户投的一方。
export async function tallyCase(
  caseId: string,
  userId: string | null,
): Promise<CourtTally> {
  const rows = await db
    .select({
      side: courtVotes.side,
      n: sql<number>`count(*)`,
    })
    .from(courtVotes)
    .where(eq(courtVotes.caseId, caseId))
    .groupBy(courtVotes.side);

  let red = 0;
  let blue = 0;
  for (const r of rows) {
    if (r.side === "red") red = r.n;
    else if (r.side === "blue") blue = r.n;
  }

  let mine: "red" | "blue" | null = null;
  if (userId) {
    const own = await db
      .select({ side: courtVotes.side })
      .from(courtVotes)
      .where(and(eq(courtVotes.caseId, caseId), eq(courtVotes.userId, userId)))
      .limit(1);
    if (own[0]) mine = own[0].side as "red" | "blue";
  }
  return { red, blue, mine };
}

// 投票 / 改投：一个用户对一场庭审只计一票，可在红蓝之间切换。
// 返回最新票数与自己的一方。
export async function castVote(
  caseId: string,
  userId: string,
  side: "red" | "blue",
  voteId: string,
): Promise<CourtTally> {
  const existing = await db
    .select({ id: courtVotes.id, side: courtVotes.side })
    .from(courtVotes)
    .where(and(eq(courtVotes.caseId, caseId), eq(courtVotes.userId, userId)))
    .limit(1);

  if (existing[0]) {
    if (existing[0].side !== side) {
      await db
        .update(courtVotes)
        .set({ side })
        .where(eq(courtVotes.id, existing[0].id));
    }
    // 已投同一方：幂等，不重复计票
  } else {
    await db
      .insert(courtVotes)
      .values({ id: voteId, caseId, userId, side })
      .onConflictDoNothing();
  }
  return tallyCase(caseId, userId);
}

// —— 全站每日一题（court_cases）——

// 按天取当日案由行；表未迁移等异常返回 null（调用方走解析链重建）。
export async function getDailyCaseRow(date: string): Promise<CourtCaseRow | null> {
  try {
    const rows = await db
      .select()
      .from(courtCases)
      .where(eq(courtCases.date, date))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("[court/queries] getDailyCaseRow failed:", error);
    return null;
  }
}

// 按 caseId 取案由行（rebut 注入证据用；caseId 全局唯一按天）。
export async function getCaseRowByCaseId(caseId: string): Promise<CourtCaseRow | null> {
  try {
    const rows = await db
      .select()
      .from(courtCases)
      .where(eq(courtCases.caseId, caseId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("[court/queries] getCaseRowByCaseId failed:", error);
    return null;
  }
}

// 落库/更新当日案由（幂等：按天主键 upsert）。
export async function upsertDailyCase(row: {
  date: string;
  caseId: string;
  source: string;
  questionUrl?: string | null;
  caseTitle: string;
  brief?: string | null;
  redAngle?: string | null;
  blueAngle?: string | null;
  tagsJson?: string | null;
  evidenceJson?: string | null;
}): Promise<void> {
  await db
    .insert(courtCases)
    .values({
      date: row.date,
      caseId: row.caseId,
      source: row.source,
      questionUrl: row.questionUrl ?? null,
      caseTitle: row.caseTitle,
      brief: row.brief ?? null,
      redAngle: row.redAngle ?? null,
      blueAngle: row.blueAngle ?? null,
      tagsJson: row.tagsJson ?? null,
      evidenceJson: row.evidenceJson ?? null,
    })
    .onConflictDoUpdate({
      target: courtCases.date,
      set: {
        caseId: row.caseId,
        source: row.source,
        questionUrl: row.questionUrl ?? null,
        caseTitle: row.caseTitle,
        brief: row.brief ?? null,
        redAngle: row.redAngle ?? null,
        blueAngle: row.blueAngle ?? null,
        tagsJson: row.tagsJson ?? null,
        evidenceJson: row.evidenceJson ?? null,
      },
    });
}
