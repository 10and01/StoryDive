import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { courtVotes } from "../schema/court";

export interface CourtTally {
  red: number;
  blue: number;
  mine: "red" | "blue" | null; // 当前用户投给了哪一方
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
