import { type NextRequest } from "next/server";
import {
  canAccessWork,
  getVersion,
  getWork,
} from "@/lib/db/queries/custom-works";
import { optionalUserId, shareTokenFrom, workDto } from "@/lib/works/api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [work, userId] = await Promise.all([getWork(id), optionalUserId(request)]);
  if (!work || !canAccessWork(work, { userId, shareToken: shareTokenFrom(request) })) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const versionId = userId === work.ownerId && !work.publishedVersionId
    ? (await import("@/lib/db/queries/custom-works")).getLatestVersion(work.id).then((version) => version?.id)
    : work.publishedVersionId;
  const resolvedId = await versionId;
  if (!resolvedId) return Response.json({ error: "not_ready" }, { status: 409 });
  const version = await getVersion(resolvedId);
  if (!version) return Response.json({ error: "version_not_found" }, { status: 404 });
  return Response.json({ work: workDto(work, { owner: userId === work.ownerId }), versionId: version.id, story: JSON.parse(version.storyJson) });
}
