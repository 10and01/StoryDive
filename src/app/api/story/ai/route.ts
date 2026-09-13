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
  groundingBlock,
  soulBlock,
  type ShadowActor,
} from "@/lib/story/ai-prompts";
import { hasZhihuSecret } from "@/lib/zhihu/client";
import { zhihuSearch, type ZhihuSearchHit } from "@/lib/zhihu/search";
import { loadConsentedCards } from "@/lib/profile/cards";
import type { UserContentCard } from "@/lib/profile/types";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";

type Mode = "dialogue" | "ensemble" | "fork" | "rewrite" | "reason";

interface AiBody {
  mode: Mode;
  storyId: string;
  characterId?: string;
  characterIds?: string[];
  anchorParagraph?: number;
  userText?: string;
  choice?: string;
  // dialogue 专用「引经据典」：检索知乎站内真实回答注入 prompt，回复可化用并标 [n]
  grounding?: boolean;
  // dialogue 专用「知乎灵魂」：把读者本人授权的知乎回答注入 prompt（角色可点破）
  soul?: boolean;
  // ensemble 专用「影子客人」：读者关注列表里的真人（公开资料），AI 想象演绎
  shadows?: { name?: string; headline?: string }[];
}

function sanitizeShadows(raw: unknown): ShadowActor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {}))
    .filter((s) => typeof s.name === "string" && s.name.trim())
    .slice(0, 3)
    .map((s) => ({
      name: (s.name as string).trim().slice(0, 20),
      headline: typeof s.headline === "string" ? s.headline.trim().slice(0, 60) : undefined,
    }));
}

// 判例卡 → 引用 chip 数据（对戏里角色点破「你自己也写过…」时可展开验证）。
function soulCitations(cards: UserContentCard[], startN: number): ZhihuCitation[] {
  return cards.map((c, i) => ({
    n: startN + i,
    title: c.title,
    contentText: c.summary,
    url: c.url,
    voteUpCount: c.likeCount,
    authorName: "你 · 知乎创作",
  }));
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
  // 「引经据典」+「知乎灵魂」命中的真实回答（随响应返回，供前端渲染引用 chip）
  const citations: ZhihuCitation[] = [];

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
      if (body.grounding && hasZhihuSecret()) {
        const hits: ZhihuSearchHit[] = await zhihuSearch(userMsg, 3);
        system += groundingBlock(hits);
        citations.push(...hits);
      }
      if (body.soul) {
        const cards = await loadConsentedCards(auth.user.id);
        if (cards.length > 0) {
          system += soulBlock(cards, citations.length + 1);
          citations.push(...soulCitations(cards, citations.length + 1));
        }
      }
    } else if (mode === "ensemble") {
      const ids = Array.isArray(body.characterIds) ? body.characterIds : [];
      const cast = story.characters.filter((c) => ids.includes(c.id));
      if (cast.length < 2) {
        return Response.json(
          { error: "Ensemble needs at least two present characters" },
          { status: 400 },
        );
      }
      const shadows = sanitizeShadows(body.shadows);
      system = ensembleSystemPrompt(story, cast, upto, shadows);
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
    return Response.json({ text, citations });
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
