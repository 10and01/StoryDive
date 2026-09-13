import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/ai-client";
import { hasZhihuSecret } from "@/lib/zhihu/client";
import {
  searchKnowledge,
  uploadKnowledgeFile,
  KnowledgeProcessingError,
} from "@/lib/zhihu/knowledge";
import {
  learningTheaterSystemPrompt,
  learningTheaterUserPrompt,
} from "@/lib/theater/prompts";
import { extractJson, toPlay } from "@/lib/theater/parse";
import type { TheaterPlay } from "@/lib/theater/types";

// POST /api/theater/custom  知识库 RAG 定制剧场（登录必需）。
// 两条路径：
// - 短文（<5000 字）直接注入 prompt 生成，不上传知乎（隐私干净、省额度）；
// - 长文/文件（md/txt/pdf，≤20MiB）上传知乎知识库（UI 已明示「将存入知乎知识库」）
//   → knowledge/search 检索知识点块 → 生成多结局学习剧场。
// 上传后处理是异步的：检索过早返回 40005 → 本路由回 {status:"processing"}，
// 前端轮询 GET 直至就绪。额度 knowledge 500/日：每局 1 上传 + ≤2 检索。

const LOCAL_TEXT_LIMIT = 5000; // 低于此长度直接注入 prompt，不走知识库
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MiB（平台上限 100MiB，收紧以护额度与 Workers 体积）
const RAG_LIMIT = 6; // 单次检索条数（≤10）

interface CustomContext {
  hint?: string;
  kbId?: string;
  recallId?: string;
}

async function dateLabelOf(): Promise<string> {
  return new Date().toISOString().slice(0, 10);
}

// 生成学习剧场：chunks 是唯一事实来源，AI 失败/解析失败返回 null（前端提示重试）
async function generatePlay(
  chunks: string[],
  ctx: CustomContext,
  viewerUserId: string,
): Promise<TheaterPlay | null> {
  const result = await appAi.chat({
    messages: [
      { role: "system", content: learningTheaterSystemPrompt() },
      { role: "user", content: learningTheaterUserPrompt(chunks, ctx.hint) },
    ],
    viewer_user_id: viewerUserId,
    temperature: 0.9,
  });
  const text = result.choices?.[0]?.message?.content ?? "";
  return toPlay(
    extractJson(text),
    { title: ctx.hint || "定制知识剧场" },
    "generated",
    await dateLabelOf(),
  );
}

// 检索材料块：hint 优先，其次通用要点检索；两次以内（护额度）
async function retrieveChunks(ctx: CustomContext): Promise<string[]> {
  const queries = [ctx.hint, "全文要点 关键结论 数据"].filter(
    (q): q is string => Boolean(q && q.trim()),
  );
  const kbIds = ctx.kbId ? [ctx.kbId] : undefined;
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const q of queries.slice(0, 2)) {
    try {
      const chunks = await searchKnowledge({
        query: q,
        knowledgeBaseIds: kbIds,
        scopes: ["personal"],
        limit: RAG_LIMIT,
      });
      for (const c of chunks) {
        const key = c.slice(0, 40);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(c);
        }
      }
    } catch (error) {
      if (error instanceof KnowledgeProcessingError) throw error;
      // 检索失败 → 尽力而为，至少还有另一条 query
    }
  }
  return merged.slice(0, RAG_LIMIT);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  if (!hasZhihuSecret()) {
    return Response.json(
      { status: "failed", code: "no_zhihu_secret", message: "未配置知乎密钥，无法生成定制剧场" },
      { status: 402 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ status: "failed", code: "bad_request" }, { status: 400 });
  }
  const hint = (form.get("hint") as string | null)?.trim().slice(0, 120) || undefined;
  const text = (form.get("text") as string | null)?.trim() || "";
  const file = form.get("file");

  // 路径一：短文直接注入（不占知识库额度，隐私干净）
  if (text && text.length < LOCAL_TEXT_LIMIT && !(file instanceof File)) {
    try {
      const play = await generatePlay([text], { hint }, auth.user.id);
      if (play) return Response.json({ status: "ready", play });
      return Response.json({ status: "failed", code: "ai_failed" });
    } catch (error) {
      console.error("[theater/custom] local generate failed:", error);
      return Response.json({ status: "failed", code: "ai_failed" });
    }
  }

  // 路径二：文件上传知乎知识库 → RAG 检索 → 生成
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ status: "failed", code: "no_material" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ status: "failed", code: "file_too_large" }, { status: 413 });
  }

  try {
    const uploaded = await uploadKnowledgeFile(file);
    if (!uploaded) {
      return Response.json({ status: "failed", code: "upload_failed" });
    }
    const ctx: CustomContext = {
      hint,
      kbId: uploaded.knowledgeBaseId || undefined,
      recallId: uploaded.recallContentId,
    };
    try {
      const chunks = await retrieveChunks(ctx);
      if (chunks.length === 0) {
        return Response.json({ status: "failed", code: "no_chunks" });
      }
      const play = await generatePlay(chunks, ctx, auth.user.id);
      if (play) return Response.json({ status: "ready", play });
      return Response.json({ status: "failed", code: "ai_failed" });
    } catch (error) {
      if (error instanceof KnowledgeProcessingError) {
        // 平台仍在解析文件：返回句柄给前端轮询
        return Response.json({
          status: "processing",
          recallContentId: uploaded.recallContentId,
          kbId: ctx.kbId ?? "",
          hint: hint ?? "",
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("[theater/custom] upload path failed:", error);
    return Response.json({ status: "failed", code: "upload_failed" });
  }
}

// GET /api/theater/custom?recallId=&kbId=&hint=  轮询：文件解析就绪后检索 + 生成。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  if (!hasZhihuSecret()) {
    return Response.json({ status: "failed", code: "no_zhihu_secret" }, { status: 402 });
  }

  const url = request.nextUrl;
  const ctx: CustomContext = {
    hint: url.searchParams.get("hint")?.slice(0, 120) || undefined,
    kbId: url.searchParams.get("kbId")?.slice(0, 40) || undefined,
    recallId: url.searchParams.get("recallId")?.slice(0, 64) || undefined,
  };
  if (!ctx.recallId) {
    return Response.json({ status: "failed", code: "bad_request" }, { status: 400 });
  }

  try {
    const chunks = await retrieveChunks(ctx);
    if (chunks.length === 0) {
      // 仍无内容：可能还在处理（极少数 40005 不抛的场景）或解析失败，前端继续轮询几次后放弃
      return Response.json({ status: "processing" });
    }
    const play = await generatePlay(chunks, ctx, auth.user.id);
    if (play) return Response.json({ status: "ready", play });
    return Response.json({ status: "failed", code: "ai_failed" });
  } catch (error) {
    if (error instanceof KnowledgeProcessingError) {
      return Response.json({ status: "processing" });
    }
    console.error("[theater/custom] poll failed:", error);
    return Response.json({ status: "failed", code: "poll_failed" });
  }
}
