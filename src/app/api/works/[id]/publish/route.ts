import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getLatestVersion,
  getWork,
  publishWork,
} from "@/lib/db/queries/custom-works";
import { errorResponse, workDto } from "@/lib/works/api";
import {
  isVisibility,
  randomShareToken,
  validatePublicMetadata,
  WorkInputError,
} from "@/lib/works/validation";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const work = await getWork(id);
    if (!work || work.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.rightsConfirmed !== true) {
      throw new WorkInputError("rights_required", "发布前请确认你拥有上传及公开该作品的权利。", 422);
    }
    if (!isVisibility(body.visibility)) throw new WorkInputError("invalid_visibility", "请选择有效的可见性。", 422);
    validatePublicMetadata({ title: work.title, description: work.description, tags: JSON.parse(work.tagsJson) });
    const version = await getLatestVersion(work.id);
    if (!version) throw new WorkInputError("version_required", "作品尚未生成完成，暂时不能发布。", 409);
    const shareToken = body.visibility === "unlisted" ? work.shareToken || randomShareToken() : null;
    const published = await publishWork({
      id: work.id,
      ownerId: auth.user.id,
      visibility: body.visibility,
      shareToken,
      versionId: version.id,
    });
    const shareUrl = shareToken ? `/works/${work.id}?token=${shareToken}` : null;
    return Response.json({ work: workDto(published!, { owner: true, shareUrl }) });
  } catch (error) {
    return errorResponse(error);
  }
}
