import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  canAccessWork,
  createCopiedWork,
  getVersion,
  getWork,
} from "@/lib/db/queries/custom-works";
import { copySourceObject, deleteSourceObject, sourceObjectKey } from "@/lib/works/storage";
import { errorResponse, shareTokenFrom, workDto } from "@/lib/works/api";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  let targetKey: string | null = null;
  try {
    const { id } = await context.params;
    const source = await getWork(id);
    const token = shareTokenFrom(request);
    if (!source || !source.publishedVersionId || !canAccessWork(source, { shareToken: token })) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const version = await getVersion(source.publishedVersionId);
    if (!version) return Response.json({ error: "version_not_found" }, { status: 404 });
    const workId = crypto.randomUUID();
    targetKey = sourceObjectKey(auth.user.id, source.sourceFormat);
    await copySourceObject(source.sourceObjectKey, targetKey);
    const copied = await createCopiedWork({
      id: workId,
      versionId: crypto.randomUUID(),
      ownerId: auth.user.id,
      ownerName: auth.user.name ?? null,
      source,
      sourceObjectKey: targetKey,
      storyJson: version.storyJson,
    });
    return Response.json({ work: workDto(copied!, { owner: true }) }, { status: 201 });
  } catch (error) {
    if (targetKey) await deleteSourceObject(targetKey).catch(() => undefined);
    return errorResponse(error);
  }
}
