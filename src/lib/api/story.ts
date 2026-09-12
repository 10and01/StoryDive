import { request } from "./request";
import { AppAIClientUnavailableError } from "./app-ai-request";
import type { StoryBranch, BranchKind } from "@/lib/story/types";

interface StoryAiInput {
  mode: "dialogue" | "ensemble" | "fork" | "rewrite" | "reason";
  storyId: string;
  characterId?: string;
  characterIds?: string[];
  anchorParagraph?: number;
  userText?: string;
  choice?: string;
}

/** Calls the App AI-backed story route. Returns "" if AI is unavailable. */
export async function generateStoryAi(input: StoryAiInput): Promise<string> {
  try {
    const res = await request("/api/story/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return data.text ?? "";
  } catch (error) {
    if (error instanceof AppAIClientUnavailableError) return "";
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
