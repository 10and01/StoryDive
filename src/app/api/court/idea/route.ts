import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError, APP_AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-client";

// POST /api/court/idea  判决书 → 知乎原生「想法」文案（登录必需）。
// 知乎开放平台当前没有发布/存草稿接口，这里生成可直接粘贴发布的原生文案：
// 话题标签 + 判决张力 + 钩子提问 + 站点链接，形成内容回流闭环。

function ideaSystemPrompt(): string {
  return `你是「盐官」，名场面法庭的说书人兼裁判。任务：把一场庭审的判决书写成一条可以直接发布到知乎「想法」的文案。

要求：
- 150-250 字，口语化但有梗，像知乎老用户发想法的口吻；
- 开头给 1-3 个话题标签：必须包含 #名场面法庭#，再从案由里提炼 1-2 个自然的话题标签（如 #职场# #悬疑推理#）；
- 正文点出案由、两造旗号、票型与判词里最锋利的一句，保留张力但不堆砌；
- 结尾抛一个钩子提问，邀请读者来站队；
- 最后一行单独给出这个链接（原样输出）：{link}
- 只输出想法文案本身，不要解释、不要 markdown。简体中文，弯引号。`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { caseTitle, redHeadline, blueHeadline } = body;
  if (
    typeof caseTitle !== "string" ||
    typeof redHeadline !== "string" ||
    typeof blueHeadline !== "string"
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const r = typeof body.redVotes === "number" && Number.isFinite(body.redVotes) ? body.redVotes : 0;
  const b = typeof body.blueVotes === "number" && Number.isFinite(body.blueVotes) ? body.blueVotes : 0;
  const verdict = typeof body.verdict === "string" ? body.verdict.slice(0, 300) : "";
  const link = `${request.nextUrl.origin}/court`;

  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: ideaSystemPrompt() },
        {
          role: "user",
          content: [
            `案由：${caseTitle}`,
            `红方旗号：${redHeadline}（${r} 票）`,
            `蓝方旗号：${blueHeadline}（${b} 票）`,
            `盐官判词：${verdict || "（观众未留判词，自行提炼一句）"}`,
            `需要附上的链接：${link}`,
          ].join("\n"),
        },
      ],
      viewer_user_id: auth.user.id,
      temperature: 0.9,
    });
    const text = (result.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("empty idea");
    return Response.json({ text });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json(
        { code: "app_ai_unavailable", message: APP_AI_UNAVAILABLE_MESSAGE },
        { status: 402 },
      );
    }
    console.error("court/idea failed:", error);
    return Response.json({ error: "ai_failed" }, { status: 500 });
  }
}
