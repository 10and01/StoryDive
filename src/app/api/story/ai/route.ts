import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/ai-client";
import { getStory } from "@/lib/story/library";
import { getReasonBoard } from "@/lib/story/reason";
import {
  dialogueSystemPrompt,
  ensembleSystemPrompt,
  forkSystemPrompt,
  rewriteSystemPrompt,
  reasonSystemPrompt,
} from "@/lib/story/ai-prompts";

type Mode = "dialogue" | "ensemble" | "fork" | "rewrite" | "reason";

interface AiBody {
  mode: Mode;
  storyId: string;
  characterId?: string;
  characterIds?: string[];
  anchorParagraph?: number;
  userText?: string;
  choice?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as AiBody;
  const { mode, storyId } = body;
  if (!mode || !storyId) {
    return Response.json({ error: "Missing mode or storyId" }, { status: 400 });
  }

  const upto = Math.max(0, body.anchorParagraph ?? 0);
  let system = "";
  let userMsg = "";

  if (mode === "reason") {
    const board = getReasonBoard(storyId);
    if (!board) return Response.json({ error: "Not found" }, { status: 404 });
    system = reasonSystemPrompt(board.title, board.intro);
    userMsg = body.choice
      ? `读者的选择：${body.choice}。请复盘这个选择。`
      : (body.userText ?? "请概述这场复盘的关键点。");
  } else {
    const story = getStory(storyId);
    if (!story) return Response.json({ error: "Not found" }, { status: 404 });

    if (mode === "dialogue") {
      const character = story.characters.find((c) => c.id === body.characterId);
      if (!character) {
        return Response.json({ error: "Character not found" }, { status: 404 });
      }
      system = dialogueSystemPrompt(story, character, upto);
      userMsg = body.userText ?? "（读者沉默地看着你）";
    } else if (mode === "ensemble") {
      const ids = Array.isArray(body.characterIds) ? body.characterIds : [];
      const cast = story.characters.filter((c) => ids.includes(c.id));
      if (cast.length < 2) {
        return Response.json(
          { error: "Ensemble needs at least two present characters" },
          { status: 400 },
        );
      }
      system = ensembleSystemPrompt(story, cast, upto);
      userMsg = body.userText ?? "（读者环视在场众人，没有说话）";
    } else if (mode === "fork") {
      system = forkSystemPrompt(story, upto);
      userMsg = `读者选择在此处：「${body.choice ?? body.userText ?? "做出不同选择"}」。请推演平行走向。`;
    } else if (mode === "rewrite") {
      system = rewriteSystemPrompt(story, upto);
      userMsg = `读者的脑洞设定：${body.userText ?? ""}。请顺着原文风格续写。`;
    } else {
      return Response.json({ error: "Invalid mode" }, { status: 400 });
    }
  }

  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      viewer_user_id: auth.user.id,
      temperature: mode === "reason" ? 0.4 : 0.9,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return Response.json({ text });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("story/ai failed:", error);
    return Response.json({ error: "ai_failed" }, { status: 500 });
  }
}
