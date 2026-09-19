import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  archiveWork,
  canAccessWork,
  getLatestGenerationJob,
  getLatestVersion,
  getModelProvider,
  getVersion,
  getWork,
  updateWorkOwned,
} from "@/lib/db/queries/custom-works";
import { errorResponse, jobDto, optionalUserId, shareTokenFrom, workDto } from "@/lib/works/api";
import {
  isVisibility,
  normalizeMetadataText,
  normalizeTags,
  validatePublicMetadata,
  WorkInputError,
} from "@/lib/works/validation";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [work, userId] = await Promise.all([getWork(id), optionalUserId(request)]);
  if (!work || !canAccessWork(work, { userId, shareToken: shareTokenFrom(request) })) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const owner = userId === work.ownerId;
  const [version, job] = await Promise.all([
    owner
      ? getLatestVersion(work.id)
      : work.publishedVersionId
        ? getVersion(work.publishedVersionId)
        : Promise.resolve(null),
    owner ? getLatestGenerationJob(work.id) : Promise.resolve(null),
  ]);
  return Response.json({
    work: workDto(work, {
      owner,
      shareUrl:
        owner && work.visibility === "unlisted" && work.shareToken
          ? `/works/${work.id}?token=${work.shareToken}`
          : null,
    }),
    preview: version ? JSON.parse(version.storyJson) : null,
    job: job ? jobDto(job) : null,
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getWork(id);
    if (!current || current.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = body.title === undefined ? current.title : normalizeMetadataText(body.title, 100);
    const description = body.description === undefined ? current.description : normalizeMetadataText(body.description, 500);
    const tags = body.tags === undefined ? JSON.parse(current.tagsJson) : normalizeTags(body.tags);
    if (!title) throw new WorkInputError("title_required", "作品标题不能为空。");
    validatePublicMetadata({ title, description, tags });
    const visibility = body.visibility === undefined ? current.visibility : body.visibility;
    if (!isVisibility(visibility)) throw new WorkInputError("invalid_visibility", "无效的可见性设置。");
    const selectedProviderId =
      body.selectedProviderId === undefined
        ? current.selectedProviderId
        : normalizeMetadataText(body.selectedProviderId, 80) || null;
    if (selectedProviderId && !(await getModelProvider(selectedProviderId, auth.user.id))) {
      throw new WorkInputError("provider_not_found", "选择的模型服务不存在或已删除。", 404);
    }
    const updated = await updateWorkOwned(id, auth.user.id, {
      title,
      description,
      tagsJson: JSON.stringify(tags),
      coverImage: body.coverImage === undefined ? current.coverImage : normalizeMetadataText(body.coverImage, 500) || null,
      visibility,
      selectedProviderId,
    });
    return Response.json({ work: workDto(updated!, { owner: true }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const archived = await archiveWork(id, auth.user.id);
  if (!archived) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
