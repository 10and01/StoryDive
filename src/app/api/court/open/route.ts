import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/ai-client";
import { pickCase, FALLBACK_CASE, COURT_AGENTS, type CourtDuel, type Difficulty, type Side } from "@/lib/court/types";
import { userCourtProfile } from "@/lib/db/queries/court";
import { briefSystemPrompt, claimSystemPrompt, claimUserPrompt } from "@/lib/court/agents";
import { extractClaim } from "@/lib/court/parse";

// POST /api/court/open  双 Agent 对抗庭开庭（登录必需）。
// 盐官出开庭陈词 + 烈盐/析盐各自立论（三路并发）；难度与立场钩子由
// 该观众的历史投票画像（court_votes 聚合）驱动。AI 失败回落手写兜底局。

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { seed?: number };
  const seed = pickCase(typeof body.seed === "number" ? body.seed : undefined);
  const day = new Date().toISOString().slice(0, 10);
  const caseId = `${seed.id}-${day}`;

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

  try {
    const [briefRes, redRes, blueRes] = await Promise.all([
      appAi.chat({
        messages: [
          { role: "system", content: briefSystemPrompt(difficulty) },
          { role: "user", content: `案由：${seed.caseTitle}\n案情：${seed.brief}` },
        ],
        viewer_user_id: auth.user.id,
        temperature: 0.9,
      }),
      appAi.chat({
        messages: [
          { role: "system", content: claimSystemPrompt("red", difficulty, lean) },
          { role: "user", content: claimUserPrompt(seed, "red") },
        ],
        viewer_user_id: auth.user.id,
        temperature: 0.9,
      }),
      appAi.chat({
        messages: [
          { role: "system", content: claimSystemPrompt("blue", difficulty, lean) },
          { role: "user", content: claimUserPrompt(seed, "blue") },
        ],
        viewer_user_id: auth.user.id,
        temperature: 0.9,
      }),
    ]);

    const brief = (briefRes.choices?.[0]?.message?.content ?? "").trim() || seed.brief;
    const red = extractClaim(redRes.choices?.[0]?.message?.content ?? "", "red");
    const blue = extractClaim(blueRes.choices?.[0]?.message?.content ?? "", "blue");
    if (!red || !blue) throw new Error("claim parse failed");

    const duel: CourtDuel = {
      id: caseId,
      caseTitle: seed.caseTitle,
      brief,
      difficulty,
      red: { ...red, agentName: COURT_AGENTS.red.name },
      blue: { ...blue, agentName: COURT_AGENTS.blue.name },
      verdictHint: "交锋三回合已毕——你更认哪一种？投出你的一票。",
    };
    return Response.json({ case: duel, profile });
  } catch (error) {
    console.error("[court/open] fell back to static case:", error);
    // 兜底：手写庭审（含现成红蓝主张），保证永不空场；回合由 rebut 兜底句撑住
    const duel: CourtDuel = {
      id: caseId,
      caseTitle: FALLBACK_CASE.caseTitle,
      brief: FALLBACK_CASE.brief,
      difficulty,
      red: { ...FALLBACK_CASE.red, agentName: COURT_AGENTS.red.name },
      blue: { ...FALLBACK_CASE.blue, agentName: COURT_AGENTS.blue.name },
      verdictHint: FALLBACK_CASE.verdictHint,
    };
    return Response.json({ case: duel, profile, fallback: true });
  }
}
