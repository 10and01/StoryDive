import { request } from "./request";
import { AppAIClientUnavailableError } from "./app-ai-request";
import type { ZhihuCitation } from "./zhihu-citation";
import type { StoryBranch, BranchKind } from "@/lib/story/types";

interface StoryAiInput {
  mode: "dialogue" | "ensemble" | "fork" | "rewrite" | "reason";
  storyId: string;
  characterId?: string;
  characterIds?: string[];
  anchorParagraph?: number;
  userText?: string;
  choice?: string;
  // dialogue 专用「引经据典」：服务端检索知乎站内真实回答注入 prompt
  grounding?: boolean;
}

/** Calls the App AI-backed story route. Returns "" if AI is unavailable. */
export async function generateStoryAi(input: StoryAiInput): Promise<string> {
  return (await generateStoryAiDetail(input)).text;
}

// 带引用明细的版本：grounding 命中时 citations 是知乎站内真实回答（[n] 编号对应）。
export async function generateStoryAiDetail(
  input: StoryAiInput,
): Promise<{ text: string; citations: ZhihuCitation[] }> {
  try {
    const res = await request("/api/story/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { text?: string; citations?: ZhihuCitation[] };
    return { text: data.text ?? "", citations: data.citations ?? [] };
  } catch (error) {
    if (error instanceof AppAIClientUnavailableError) return { text: "", citations: [] };
    throw error;
  }
}

interface BranchRowDTO {
  id: string;
  storyId: string;
  storyTitle: string;
  kind: BranchKind;
  anchorParagraph: number;
  parentId: string | null;
  title: string;
  body: string;
  createdAt: string;
}

function toBranch(r: BranchRowDTO): StoryBranch {
  return {
    id: r.id,
    storyId: r.storyId,
    storyTitle: r.storyTitle,
    kind: r.kind,
    anchorParagraph: r.anchorParagraph,
    parentId: r.parentId ?? null,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
  };
}

// The API returns snake_case-free JSON (Drizzle infers camelCase keys).
export async function fetchBranches(storyId?: string): Promise<StoryBranch[]> {
  const qs = storyId ? `?storyId=${encodeURIComponent(storyId)}` : "";
  const res = await request(`/api/branches${qs}`, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { branches: BranchRowDTO[] };
  return data.branches.map(toBranch);
}

export async function saveBranch(input: {
  storyId: string;
  storyTitle: string;
  kind: BranchKind;
  anchorParagraph: number;
  parentId?: string | null;
  title: string;
  body: string;
}): Promise<StoryBranch> {
  const res = await request("/api/branches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { branch: BranchRowDTO };
  return toBranch(data.branch);
}
