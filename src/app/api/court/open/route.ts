import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/ai-client";
import {
  FALLBACK_CASE,
  COURT_AGENTS,
  type CourtDuel,
  type Difficulty,
  type Side,
} from "@/lib/court/types";
import { resolveDailyCase, poolCaseOfDay, type DailyCase } from "@/lib/court/daily-case";
import { userCourtProfile } from "@/lib/db/queries/court";
import { getUserProfileRow } from "@/lib/db/queries/profile";
import {
  briefSystemPrompt,
  claimSystemPrompt,
  claimUserPrompt,
  type AudienceHint,
} from "@/lib/court/agents";
import { extractClaim } from "@/lib/court/parse";
import type { UserProfile } from "@/lib/profile/types";

// POST /api/court/open  双 Agent 对抗庭开庭（登录必需）。
// 辩题来自「全站每日一题」：知乎画像模式推荐的真实问题 → AI 改写案由（resolveDailyCase
// 内含 D1 当日缓存与本地池兜底）。「同题+个性化演绎」——辩题全站统一（投票按 caseId
// 聚合），个性化在演绎层：观众画像（知乎创作提炼）注入旁听席钩子，证据池
// （question_answers 真实回答摘要）注入论据战纪律。AI 失败回落手写兜底局。

function audienceFromProfileJson(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as UserProfile;
    return p && (p.summary || (p.keywords?.length ?? 0) > 0) ? p : null;
  } catch {
    return null;
  }
}

// 立论调用（解析失败重试时复用）
function claimCall(
  side: Side,
  daily: DailyCase,
  difficulty: Difficulty,
  lean: Side | null,
  audience: AudienceHint | undefined,
  userId: string,
) {
  return appAi.chat({
    messages: [
      { role: "system", content: claimSystemPrompt(side, difficulty, lean, daily.evidence, audience) },
      { role: "user", content: claimUserPrompt(daily, side) },
    ],
    viewer_user_id: userId,
    temperature: 0.9,
  });
}

// AI 立论失败时的兜底局：直接用当日案由的两造角度，保证案由/证据/深挖入口一致。
function fallbackDuel(daily: DailyCase, difficulty: Difficulty): CourtDuel {
  const headlineOf = (angle: string) => angle.split(/[——。]/)[0].trim().slice(0, 18) || angle.slice(0, 18);
  return {
    id: daily.caseId,
    caseTitle: daily.caseTitle,
    brief: daily.brief,
    difficulty,
    red: {
      side: "red",
      headline: headlineOf(daily.redAngle),
      argument: daily.redAngle,
      agentName: COURT_AGENTS.red.name,
    },
    blue: {
      side: "blue",
      headline: headlineOf(daily.blueAngle),
      argument: daily.blueAngle,
      agentName: COURT_AGENTS.blue.name,
    },
    verdictHint: FALLBACK_CASE.verdictHint,
    questionUrl: daily.questionUrl,
    evidence: daily.evidence.all.length ? daily.evidence.all : undefined,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  // body.seed 兼容旧客户端签名，新流程辩题由服务端按天解析，seed 不再参与选题
  await request.json().catch(() => ({}));
  const day = new Date().toISOString().slice(0, 10);

  // 每日案由解析链（内含缓存/推荐/兜底，不抛异常）
  let daily: DailyCase | null = null;
  try {
    daily = await resolveDailyCase();
  } catch (error) {
    console.error("[court/open] daily case resolution failed", error);
  }
  if (!daily) daily = await poolCaseOfDay(day);

  // 观众画像只是增强项，查询失败不拦开庭
  let difficulty: Difficulty = 1;
  let lean: Side | null = null;
  let profile: Awaited<ReturnType<typeof userCourtProfile>> | null = null;
  try {
    profile = await userCourtProfile(auth.user.id);
    difficulty = profile.difficulty;
    lean = profile.lean;
  } catch (error) {
    console.error("[court/open] profile failed", error);
  }

  // 旁听席画像（知乎创作提炼，需用户主动同步过）
  let audience: AudienceHint | undefined;
  try {
    const row = await getUserProfileRow(auth.user.id);
    const p = audienceFromProfileJson(row?.profileJson ?? null);
    if (p) audience = { summary: p.summary, keywords: p.keywords };
  } catch (error) {
    console.error("[court/open] audience profile failed", error);
  }

  try {
    const [briefRes, redRes, blueRes] = await Promise.all([
      appAi.chat({
        messages: [
          { role: "system", content: briefSystemPrompt(difficulty, audience) },
          { role: "user", content: `案由：${daily.caseTitle}\n案情：${daily.brief}` },
        ],
        viewer_user_id: auth.user.id,
        temperature: 0.9,
      }),
      claimCall("red", daily, difficulty, lean, audience, auth.user.id),
      claimCall("blue", daily, difficulty, lean, audience, auth.user.id),
    ]);

    const brief = (briefRes.choices?.[0]?.message?.content ?? "").trim() || daily.brief;
    const redRaw = redRes.choices?.[0]?.message?.content ?? "";
    const blueRaw = blueRes.choices?.[0]?.message?.content ?? "";
    let red = extractClaim(redRaw, "red");
    let blue = extractClaim(blueRaw, "blue");
    // 模型偶发坏 JSON：失败的那一侧自动重试一次（成本低，成功率优先）
    if (!red || !blue) {
      console.error("[court/open] claim parse failed once, retrying failed side(s)");
      const [redRetry, blueRetry] = await Promise.all([
        red ? Promise.resolve(null) : claimCall("red", daily, difficulty, lean, audience, auth.user.id),
        blue ? Promise.resolve(null) : claimCall("blue", daily, difficulty, lean, audience, auth.user.id),
      ]);
      if (!red && redRetry) red = extractClaim(redRetry.choices?.[0]?.message?.content ?? "", "red");
      if (!blue && blueRetry) blue = extractClaim(blueRetry.choices?.[0]?.message?.content ?? "", "blue");
    }
    if (!red || !blue) throw new Error("claim parse failed");

    const duel: CourtDuel = {
      id: daily.caseId,
      caseTitle: daily.caseTitle,
      brief,
      difficulty,
      red: { ...red, agentName: COURT_AGENTS.red.name },
      blue: { ...blue, agentName: COURT_AGENTS.blue.name },
      verdictHint: "交锋三回合已毕——你更认哪一种？投出你的一票。",
      questionUrl: daily.questionUrl,
      evidence: daily.evidence.all.length ? daily.evidence.all : undefined,
      personalized: Boolean(audience),
    };
    return Response.json({ case: duel, profile });
  } catch (error) {
    console.error("[court/open] fell back to static-angle duel:", error);
    // 兜底：当日案由 + 两造角度直出（案由/证据/深挖入口保持一致，永不空场）
    return Response.json({ case: fallbackDuel(daily, difficulty), profile, fallback: true });
  }
}
