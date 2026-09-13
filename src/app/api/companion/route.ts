import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError, APP_AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-client";
import { getStory } from "@/lib/story/library";
import { LOOKSHAN_PERSONA, lookshanUserMessage } from "@/lib/story/companion-prompts";
import { hasZhihuSecret } from "@/lib/zhihu/client";
import { zhihuSearch, type ZhihuSearchHit } from "@/lib/zhihu/search";
import { zhidaChat, type ZhidaMessage } from "@/lib/zhihu/zhida";

// POST /api/companion  刘看山伴读对话（登录必需）。
// 管线：用户消息 → 知乎站内检索真实回答 → 直答生成角色化回复（带 [n] 引用）；
// 无密钥或直答失败时回落应用内 LLM（不引用），保证伴读永不空场。

interface CompanionBody {
  storyId?: string;
  paragraph?: number;
  message?: string;
  history?: { role?: string; content?: string }[];
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as CompanionBody;
  const message = (body.message ?? "").trim().slice(0, 500);
  if (!body.storyId || !message) {
    return Response.json({ error: "Missing storyId or message" }, { status: 400 });
  }
  const story = getStory(body.storyId);
  if (!story) return Response.json({ error: "Not found" }, { status: 404 });

  const paragraph = Math.max(0, Math.floor(Number(body.paragraph ?? 0)) || 0);
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string",
    )
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));

  // 1) 站内检索真实回答（无密钥/失败 → 空，走不引用的纯角色戏）
  const refs: ZhihuSearchHit[] = hasZhihuSecret() ? await zhihuSearch(message, 4) : [];
  const userMsg = lookshanUserMessage(story, paragraph, message, refs);

  // 2) 直答优先（知乎自己的大脑），失败回落应用内 LLM
  let reply = "";
  let source: "zhida" | "app" = "app";
  if (hasZhihuSecret()) {
    try {
      const messages: ZhidaMessage[] = [
        { role: "system", content: LOOKSHAN_PERSONA },
        ...history,
        { role: "user", content: userMsg },
      ];
      reply = await zhidaChat(messages, "zhida-fast-1p5");
      source = "zhida";
    } catch {
      // 直答额度耗尽/服务异常 → 降级走 appAi
    }
  }

  if (!reply) {
    try {
      const result = await appAi.chat({
        messages: [
          { role: "system", content: LOOKSHAN_PERSONA },
          ...history,
          { role: "user", content: userMsg },
        ],
        viewer_user_id: auth.user.id,
        temperature: 0.8,
      });
      reply = result.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof AppAIUnavailableError) {
        return Response.json(
          { code: "app_ai_unavailable", message: APP_AI_UNAVAILABLE_MESSAGE },
          { status: 402 },
        );
      }
      console.error("companion failed:", error);
      return Response.json({ error: "ai_failed" }, { status: 500 });
    }
  }

  if (!reply) {
    return Response.json(
      { code: "app_ai_unavailable", message: APP_AI_UNAVAILABLE_MESSAGE },
      { status: 402 },
    );
  }
  return Response.json({ reply, citations: refs, source });
}
