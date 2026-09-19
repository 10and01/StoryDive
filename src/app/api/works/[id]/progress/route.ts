import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  canAccessWork,
  getPlaySession,
  getVersion,
  getWork,
  savePlayProgress,
} from "@/lib/db/queries/custom-works";
import { shareTokenFrom } from "@/lib/works/api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const work = await getWork(id);
  if (!work || !canAccessWork(work, { userId: auth.user.id, shareToken: shareTokenFrom(request) })) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const progress = await getPlaySession(id, auth.user.id);
  return Response.json({ progress });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const work = await getWork(id);
  if (!work || !canAccessWork(work, { userId: auth.user.id, shareToken: shareTokenFrom(request) })) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const versionId = typeof body.versionId === "string" ? body.versionId : work.publishedVersionId;
  const version = versionId ? await getVersion(versionId) : null;
  if (!version || version.workId !== work.id) {
    return Response.json({ error: "invalid_version" }, { status: 400 });
  }
  const progress = await savePlayProgress({
    workId: work.id,
    versionId: version.id,
    userId: auth.user.id,
    currentChapter: Math.max(0, Math.floor(Number(body.currentChapter) || 0)),
    currentParagraph: Math.max(0, Math.floor(Number(body.currentParagraph) || 0)),
    progressJson: JSON.stringify(body.progress && typeof body.progress === "object" ? body.progress : {}),
    stateJson: JSON.stringify(body.state && typeof body.state === "object" ? body.state : {}),
    eventKind: typeof body.eventKind === "string" ? body.eventKind.slice(0, 50) : undefined,
    eventPayloadJson: JSON.stringify(body.eventPayload && typeof body.eventPayload === "object" ? body.eventPayload : {}),
  });
  return Response.json({ progress });
}
