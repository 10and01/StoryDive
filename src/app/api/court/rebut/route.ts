import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/ai-client";
import type { Difficulty, Side } from "@/lib/court/types";
import { rebutSystemPrompt, rebutUserPrompt, fallbackRebut } from "@/lib/court/agents";

// POST /api/court/rebut  单回合单方发言（登录必需）。
// 服务端无状态：transcript 由客户端持有并回传——该 Agent 能看到对方
// 全部已出口的话，对抗是真实的逐轮回应。AI 失败回落风格化兜底句。

interface RebutBody {
  caseTitle?: string;
  brief?: string;
  redHeadline?: string;
  blueHeadline?: string;
  transcript?: { side?: string; text?: string }[];
  side?: string;
  difficulty?: number;
  roundNo?: number;
  lean?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as RebutBody;
  const side: Side | null = body.side === "red" || body.side === "blue" ? body.side : null;
  if (!side || !body.caseTitle || !body.redHeadline || !body.blueHeadline) {
    return Response.json({ error: "Invalid rebut request" }, { status: 400 });
  }
  const difficulty: Difficulty = body.difficulty === 2 || body.difficulty === 3 ? body.difficulty : 1;
  const lean: Side | null = body.lean === "red" || body.lean === "blue" ? body.lean : null;
  const transcript = (Array.isArray(body.transcript) ? body.transcript : [])
    .filter(
      (t): t is { side: Side; text: string } =>
        (t?.side === "red" || t?.side === "blue") && typeof t?.text === "string",
    )
    .slice(-8)
    .map((t) => ({ side: t.side, text: t.text.slice(0, 200) }));
  const roundNo = Math.max(1, Math.min(9, Number(body.roundNo) || Math.floor(transcript.length / 2) + 1));

  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: rebutSystemPrompt(side, difficulty, lean) },
        {
          role: "user",
          content: rebutUserPrompt({
            caseTitle: body.caseTitle.slice(0, 120),
            brief: (body.brief ?? "").slice(0, 400),
            redHeadline: body.redHeadline.slice(0, 60),
            blueHeadline: body.blueHeadline.slice(0, 60),
            transcript,
            side,
          }),
        },
      ],
      viewer_user_id: auth.user.id,
      temperature: 1.0,
    });
    const text = (result.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("empty rebut");
    return Response.json({ text });
  } catch (error) {
    console.error("[court/rebut] fell back:", error);
    return Response.json({ text: fallbackRebut(side, roundNo), fallback: true });
  }
}
