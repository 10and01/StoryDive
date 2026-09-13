// 知乎知识库 API（http-api.md「知识库 API」章节）：
// 文件上传（multipart）+ RAG 检索 + 知识库列表，支撑「定制剧场」——
// 用户上传长文/论文，检索知识点块注入学习剧场生成。
// 约束（务必遵守）：
// - 仅 Bearer + 秒级时间戳鉴权（不支持 X-OAuth-Token，身份为租户本人）；
// - 文件 ≤ 100MiB，单个非空文件；同步 POST 不可自动重试；
// - 上传后处理是异步的：检索过早会返回 40005（处理中），调用方轮询；
// - 额度 knowledge 组默认 500/自然日，上传与检索各计一次。

import { zhihuHeaders } from "./client";

const BASES_ENDPOINT = "https://developer.zhihu.com/api/v1/knowledge/bases";
const UPLOAD_ENDPOINT = "https://developer.zhihu.com/api/v1/knowledge/files";
const SEARCH_ENDPOINT = "https://developer.zhihu.com/api/v1/knowledge/search";

export class KnowledgeProcessingError extends Error {
  code = "processing";
  constructor() {
    super("knowledge file is still processing (40005)");
    this.name = "KnowledgeProcessingError";
  }
}

interface KnowledgeEnvelope {
  Code?: number;
  Message?: string;
  Data?: unknown;
}

// 统一错误映射：40005 → 处理中（调用方轮询）；其余非 0 → null（调用方降级）。
async function knowledgeFetch(
  url: string,
  init: RequestInit,
): Promise<KnowledgeEnvelope | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...init.headers },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as KnowledgeEnvelope | null;
    if (!res.ok || !data) return null;
    if (data.Code === 40005) throw new KnowledgeProcessingError();
    if (data.Code !== 0) return null;
    return data;
  } catch (error) {
    if (error instanceof KnowledgeProcessingError) throw error;
    return null;
  }
}

// —— 知识库列表：拿默认库 ID（上传不指定库时服务端也会落默认库，这里用于检索定位）——
export interface KnowledgeBase {
  id: string; // 十进制字符串（大整数按字符串传输）
  name: string;
  isDefault: boolean;
  contentCount: number;
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const data = await knowledgeFetch(`${BASES_ENDPOINT}?Scope=all`, { method: "GET" });
  if (!data?.Data) return [];
  const items = (data.Data as { Items?: Record<string, unknown>[] }).Items ?? [];
  const out: KnowledgeBase[] = [];
  for (const raw of items) {
    if (typeof raw.KnowledgeBaseID !== "string") continue;
    out.push({
      id: raw.KnowledgeBaseID,
      name: typeof raw.Name === "string" ? raw.Name : "",
      isDefault: raw.IsDefault === true,
      contentCount: typeof raw.ContentCount === "number" ? raw.ContentCount : 0,
    });
  }
  return out;
}

// —— 文件上传（multipart 转发；调用方负责大小限制与「将存入知乎知识库」的明示声明）——
export interface UploadedKnowledgeFile {
  knowledgeBaseId: string;
  recallContentId: string;
  fileName: string;
  fileSize: number;
  title?: string;
}

export async function uploadKnowledgeFile(
  file: File,
  knowledgeBaseId?: string,
): Promise<UploadedKnowledgeFile | null> {
  const form = new FormData();
  form.append("File", file, file.name || "material.md");
  if (knowledgeBaseId) form.append("KnowledgeBaseID", knowledgeBaseId);
  const data = await knowledgeFetch(UPLOAD_ENDPOINT, { method: "POST", body: form });
  if (!data?.Data) return null;
  const d = data.Data as Record<string, unknown>;
  if (typeof d.RecallContentID !== "string") return null;
  return {
    knowledgeBaseId: typeof d.KnowledgeBaseID === "string" ? d.KnowledgeBaseID : "",
    recallContentId: d.RecallContentID,
    fileName: typeof d.FileName === "string" ? d.FileName : "",
    fileSize: typeof d.FileSize === "number" ? d.FileSize : 0,
    title: typeof d.Title === "string" ? d.Title : undefined,
  };
}

// —— RAG 检索：返回有序 chunk 文本；文件处理中抛 KnowledgeProcessingError ——
export async function searchKnowledge(opts: {
  query: string;
  knowledgeBaseIds?: string[];
  scopes?: ("personal" | "subscription" | "public")[];
  limit?: number;
}): Promise<string[]> {
  const body: Record<string, unknown> = {
    Query: opts.query.slice(0, 200),
    Limit: Math.max(1, Math.min(10, opts.limit ?? 5)),
  };
  if (opts.knowledgeBaseIds?.length) body.KnowledgeBaseIDs = opts.knowledgeBaseIds;
  if (opts.scopes?.length) body.RecallScopes = opts.scopes;
  const data = await knowledgeFetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!data?.Data) return [];
  const content = (data.Data as { Content?: unknown }).Content;
  return Array.isArray(content) ? content.filter((c): c is string => typeof c === "string") : [];
}
