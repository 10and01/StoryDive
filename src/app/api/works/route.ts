import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  archiveWork,
  createGenerationJob,
  createWork,
  listUserWorks,
} from "@/lib/db/queries/custom-works";
import { enqueueGeneration, providerSnapshotFor } from "@/lib/works/generation";
import { deleteSourceObject, putSourceObject, sourceObjectKey } from "@/lib/works/storage";
import {
  normalizeMetadataText,
  normalizeTags,
  safeFileName,
  sourceFormatFromFile,
  WorkInputError,
} from "@/lib/works/validation";
import { errorResponse, jobDto, workDto } from "@/lib/works/api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const works = await listUserWorks(auth.user.id);
  return Response.json({ works: works.map((work) => workDto(work, { owner: true })) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new WorkInputError("file_required", "请选择要上传的小说文件。");
    const format = sourceFormatFromFile(file);
    const fileName = safeFileName(file.name);
    const title = normalizeMetadataText(form.get("title"), 100) || fileName.replace(/\.(txt|md|markdown|epub)$/i, "");
    const description = normalizeMetadataText(form.get("description"), 500);
    const tags = normalizeTags(form.get("tags"));
    const themePrompt = normalizeMetadataText(form.get("themePrompt"), 1000) || null;
    const providerId = normalizeMetadataText(form.get("providerId"), 80) || null;
    const workId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    objectKey = sourceObjectKey(auth.user.id, format);
    const providerSnapshot = await providerSnapshotFor(auth.user.id, providerId);
    await putSourceObject(objectKey, file, { ownerId: auth.user.id, workId, format });
    const work = await createWork({
      id: workId,
      ownerId: auth.user.id,
      ownerName: auth.user.name ?? null,
      title,
      description,
      tagsJson: JSON.stringify(tags),
      themePrompt,
      sourceFormat: format,
      sourceFileName: fileName,
      sourceObjectKey: objectKey,
      selectedProviderId: providerId,
    });
    let job;
    try {
      job = await createGenerationJob({
        id: jobId,
        workId,
        ownerId: auth.user.id,
        providerSnapshotJson: JSON.stringify(providerSnapshot),
      });
      await enqueueGeneration({ jobId, workId });
    } catch (error) {
      await deleteSourceObject(objectKey).catch(() => undefined);
      await archiveWork(workId, auth.user.id).catch(() => undefined);
      objectKey = null;
      throw error;
    }
    return Response.json(
      { work: workDto(work, { owner: true }), job: jobDto(job), workId, jobId, status: job.status },
      { status: 201 },
    );
  } catch (error) {
    if (objectKey) await deleteSourceObject(objectKey).catch(() => undefined);
    return errorResponse(error);
  }
}
