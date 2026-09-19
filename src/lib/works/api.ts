import type { NextRequest } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/auth/session";
import type { CustomWorkRow } from "@/lib/db/schema/custom-works";
import type { StoryGenerationJobRow } from "@/lib/db/schema/custom-works";

export async function optionalUserId(request: Request): Promise<string | null> {
  const session = await verifySession(readSessionCookie(request));
  return session && !session.guest ? session.id : null;
}

export function shareTokenFrom(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("token") || request.headers.get("x-work-share-token");
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function workDto(work: CustomWorkRow, options?: { owner?: boolean; shareUrl?: string | null }) {
  return {
    id: work.id,
    ownerId: work.ownerId,
    ownerName: work.ownerName,
    title: work.title,
    description: work.description,
    tags: parseJsonArray(work.tagsJson),
    coverImage: work.coverImage,
    sourceFormat: work.sourceFormat,
    sourceFileName: options?.owner ? work.sourceFileName : undefined,
    visibility: work.visibility,
    status: work.status,
    safetyStatus: work.safetyStatus,
    rightsConfirmed: work.rightsConfirmed,
    selectedProviderId: options?.owner ? work.selectedProviderId : undefined,
    publishedVersionId: work.publishedVersionId,
    sourceWorkId: work.sourceWorkId,
    sourceWorkTitle: work.sourceWorkTitle,
    publishedAt: work.publishedAt?.toISOString() ?? null,
    createdAt: work.createdAt.toISOString(),
    updatedAt: work.updatedAt.toISOString(),
    shareUrl: options?.shareUrl ?? null,
  };
}

export function jobDto(job: StoryGenerationJobRow) {
  let providerName = "平台默认模型";
  try {
    providerName = JSON.parse(job.providerSnapshotJson || "{}").name || providerName;
  } catch {
    // Keep the public fallback and never expose snapshot secrets.
  }
  return {
    id: job.id,
    workId: job.workId,
    versionId: job.versionId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    providerName,
    attemptCount: job.attemptCount,
    canRetry: job.status === "failed",
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function errorResponse(error: unknown): Response {
  const candidate = error as { code?: string; status?: number; message?: string };
  const status = typeof candidate.status === "number" ? candidate.status : 500;
  const message = status < 500 && candidate.message ? candidate.message : "服务暂时不可用，请稍后重试。";
  return Response.json({ error: candidate.code || "internal_error", message }, { status });
}
