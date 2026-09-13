import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError, APP_AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-client";
import { hasZhihuSecret } from "@/lib/zhihu/client";
import { fetchQuestionAnswers } from "@/lib/zhihu/question-answers";
import { zhihuSearch, type ZhihuSearchHit } from "@/lib/zhihu/search";
import { zhidaChat, type ZhidaMessage } from "@/lib/zhihu/zhida";
import type { ZhihuCitation } from "@/lib/api/zhihu-citation";

// POST /api/court/deepdive  看山伴读「深挖这个问题」模式（登录必需）。
// 优先 question_answers（问题 URL 下的真实回答摘要，含链接）；没有问题 URL 时
// 退站内搜索。直答生成观点综述（[n] 引用纪律同伴读），失败回落应用内 LLM。

const DEEPDIVE_PERSONA = `你是刘看山，知乎的官方吉祥物，现在执行「深挖这个问题」任务：把一个问题下真实回答的精华讲给用户听。
任务要求：
- 概括这个问题下知乎回答们的主要观点与分歧：主流说什么、反方说什么、最有趣或最扎心的角度是什么；
- 只准引用提供的【知乎真实回答】，用 [1][2] 这样的编号标注，绝不编造编号；没有提供回答时，直说暂时没挖到回答，不要装作引用过；
- 化用而非照搬，保持看山活泼好奇的口吻，「谢邀」这类梗点到为止；
- 回复 4-8 句；不用 markdown 标题、列表和代码块；台词与引用一律使用中文弯引号“”。`;

interface DeepDiveBody {
  questionUrl?: string;
  topic?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as DeepDiveBody;
  const questionUrl = (body.questionUrl ?? "").trim();
  const topic = (body.topic ?? "").trim().slice(0, 120);
  if (!questionUrl && !topic) {
    return Response.json({ error: "Missing questionUrl or topic" }, { status: 400 });
  }
  if (!hasZhihuSecret()) {
    return Response.json({ code: "no_evidence", message: "未配置知乎密钥，无法深挖" }, { status: 402 });
  }

  // 1) 证据：优先问题 URL 下的真实回答摘要；没有 URL（本地池案由）退站内搜索
  let citations: ZhihuCitation[] = [];
  const answers = questionUrl ? await fetchQuestionAnswers(questionUrl, 10) : [];
  if (answers.length > 0) {
    // 一次搜索交叉标注赞同数（question_answers 无赞同数字段），失败不拦
    const votesByUrl = new Map<string, number>();
    if (topic) {
      const hits = await zhihuSearch(topic, 10);
      for (const h of hits) votesByUrl.set(h.url, h.voteUpCount);
    }
    citations = answers.map((a, i) => ({
      n: i + 1,
      title: topic || "知乎问题下的回答",
      contentText: a.summary,
      url: a.url,
      voteUpCount: votesByUrl.get(a.url) ?? 0,
      authorName: "知乎答主",
    }));
  } else if (topic) {
    const hits: ZhihuSearchHit[] = await zhihuSearch(topic, 5);
    citations = hits.map((h) => ({
      n: h.n,
      title: h.title,
      contentText: h.contentText,
      url: h.url,
      voteUpCount: h.voteUpCount,
      authorName: h.authorName,
      authorAvatar: h.authorAvatar,
      contentType: h.contentType,
    }));
  }
  if (citations.length === 0) {
    return Response.json({ code: "no_evidence", message: "这个问题暂时挖不到回答" });
  }

  const userMsg = [
    `【深挖对象】${topic || questionUrl}`,
    "【知乎真实回答】",
    ...citations.map((c) => `[${c.n}] 赞同 ${c.voteUpCount || "—"}\n${(c.contentText ?? "").slice(0, 180)}`),
    "请把这个问题挖给大家看。",
  ].join("\n");

  // 2) 直答优先，失败回落应用内 LLM（同 persona 与证据）
  let reply = "";
  let source: "zhida" | "app" = "app";
  try {
    const messages: ZhidaMessage[] = [
      { role: "system", content: DEEPDIVE_PERSONA },
      { role: "user", content: userMsg },
    ];
    reply = await zhidaChat(messages, "zhida-fast-1p5");
    source = "zhida";
  } catch {
    // 直答额度耗尽/服务异常 → 降级
  }

  if (!reply) {
    try {
      const result = await appAi.chat({
        messages: [
          { role: "system", content: DEEPDIVE_PERSONA },
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
      console.error("[court/deepdive] failed:", error);
      return Response.json({ error: "ai_failed" }, { status: 500 });
    }
  }
  if (!reply) {
    return Response.json(
      { code: "app_ai_unavailable", message: APP_AI_UNAVAILABLE_MESSAGE },
      { status: 402 },
    );
  }
  return Response.json({ reply, citations, source });
}
