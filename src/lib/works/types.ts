import type { Story } from "@/lib/story/types";

export const WORK_VISIBILITIES = ["private", "unlisted", "public"] as const;
export const WORK_STATUSES = ["draft", "processing", "ready", "failed", "archived"] as const;
export const JOB_STATUSES = [
  "queued",
  "parsing",
  "extracting",
  "generating",
  "ready",
  "failed",
] as const;

export type WorkVisibility = (typeof WORK_VISIBILITIES)[number];
export type WorkStatus = (typeof WORK_STATUSES)[number];
export type GenerationJobStatus = (typeof JOB_STATUSES)[number];

export interface ParsedNovelChapter {
  title: string;
  paragraphs: string[];
}

export interface ParsedNovel {
  title: string;
  characterCount: number;
  chapters: ParsedNovelChapter[];
}

export interface GeneratedStoryEnvelope {
  title?: string;
  description?: string;
  tags?: string[];
  story: Story;
}

export interface ProviderSnapshot {
  kind: "platform" | "custom";
  providerId?: string;
  name: string;
  baseUrl?: string;
  model?: string;
  encryptedApiKey?: string;
}

export interface QueueGenerationMessage {
  jobId: string;
  workId: string;
}

export interface WorkAccessContext {
  userId?: string | null;
  shareToken?: string | null;
}
