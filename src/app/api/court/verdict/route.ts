import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/ai-client";
import { judgeVerdictPrompt } from "@/lib/court/prompts";
import { loadConsentedCards, cardsBlock } from "@/lib/profile/cards";

// POST /api/court/verdict  投票结束后，盐官依票数给一句总评（登录必需）。
// 观众同步过「知乎判例卡」时，判词可点一句 TA 的立场与其写过的东西的呼应（为你而设）。
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { caseTitle, redHeadline, blueHeadline, redVotes, blueVotes } = body;
  if (
    typeof caseTitle !== "string" ||
    typeof redHeadline !== "string" ||
    typeof blueHeadline !== "string"
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const r = typeof redVotes === "number" && Number.isFinite(redVotes) ? redVotes : 0;
  const b = typeof blueVotes === "number" && Number.isFinite(blueVotes) ? blueVotes : 0;

  let content = judgeVerdictPrompt(caseTitle, redHeadline, blueHeadline, r, b);
  try {
    const cards = await loadConsentedCards(auth.user.id);
    if (cards.length > 0) {
      content += `\n\n${cardsBlock(cards)}\n判词里可以点一句：这位观众今天的投票与 TA 自己写过的东西如何呼应——一眼认出 TA，自然收住，不强求。`;
    }
  } catch {
    // 判例卡读取失败不拦判词
  }

  // 无 AI 时的兜底总评（依旧点出胜负）
  const fallback =
    r === b
      ? "盐官：两造旗鼓相当，这一局，观众的犹豫本身就是答案。"
      : r > b
        ? `盐官：民心所向，“${redHeadline}”胜出——但败方那点不甘，也值得记上一笔。`
        : `盐官：“${blueHeadline}”赢下这一庭——赢在它敢把话说透，红方输得并不冤。`;

  try {
    const result = await appAi.chat({
      messages: [{ role: "user", content }],
      viewer_user_id: auth.user.id,
      temperature: 0.8,
    });
    const text = result.choices?.[0]?.message?.content?.trim();
    return Response.json({ verdict: text || fallback });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json({ verdict: fallback });
    }
    throw error;
  }
}
