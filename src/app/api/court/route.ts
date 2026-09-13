import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/ai-client";
import { courtSystemPrompt, courtUserPrompt } from "@/lib/court/prompts";
import {
  pickCase,
  FALLBACK_CASE,
  type CourtCase,
  type CourtClaim,
  type CourtRound,
} from "@/lib/court/types";

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function toClaim(o: unknown, side: "red" | "blue"): CourtClaim | null {
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  if (typeof c.headline !== "string" || typeof c.argument !== "string") return null;
  return { side, headline: c.headline, argument: c.argument };
}

// 校验并规整成 CourtCase：红蓝两造 + 交锋回合齐备。caseId 用确定性 id，供投票聚合。
function toCase(obj: unknown, caseId: string, caseTitle: string): CourtCase | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const red = toClaim(o.red, "red");
  const blue = toClaim(o.blue, "blue");
  if (!red || !blue) return null;

  const roundsRaw = Array.isArray(o.rounds) ? o.rounds : [];
  const rounds: CourtRound[] = [];
  for (const r of roundsRaw) {
    const ro = r as Record<string, unknown>;
    if (typeof ro.red === "string" && typeof ro.blue === "string") {
      rounds.push({ red: ro.red, blue: ro.blue });
    }
  }
  if (rounds.length < 2) return null;

  return {
    id: caseId,
    caseTitle,
    brief: typeof o.brief === "string" ? o.brief : caseTitle,
    source: "generated",
    red,
    blue,
    rounds,
    verdictHint:
      typeof o.verdictHint === "string"
        ? o.verdictHint
        : "两造陈词已毕——你更认哪一种？投出你的一票。",
    createdAt: new Date().toISOString(),
  };
}

// GET /api/court  盐灵现开一场庭审（登录必需）。
// caseId 用「案由种子 id + 当天」拼成，保证同一天同一案由的投票汇聚到一起。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const seedParam = request.nextUrl.searchParams.get("seed");
  const seed = seedParam ? Number.parseInt(seedParam, 10) : Date.now();
  const caseSeed = pickCase(seed);
  const day = new Date().toISOString().slice(0, 10);
  const caseId = `${caseSeed.id}-${day}`;

  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: courtSystemPrompt() },
        { role: "user", content: courtUserPrompt(caseSeed) },
      ],
      viewer_user_id: auth.user.id,
      temperature: 0.9,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    const c = toCase(extractJson(text), caseId, caseSeed.caseTitle);
    if (c) return Response.json({ case: c });
    return Response.json({ case: { ...FALLBACK_CASE, id: caseId } });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json({ case: { ...FALLBACK_CASE, id: caseId } });
    }
    throw error;
  }
}
