import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createGenerationJob,
  getGenerationJob,
  getWork,
} from "@/lib/db/queries/custom-works";
import { enqueueGeneration, providerSnapshotFor } from "@/lib/works/generation";
import { errorResponse, jobDto } from "@/lib/works/api";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const previous = await getGenerationJob(id);
    if (!previous || previous.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
    if (previous.status !== "failed") return Response.json({ error: "job_not_failed" }, { status: 409 });
    const work = await getWork(previous.workId);
    if (!work || work.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { usePlatformDefault?: boolean };
    const providerId = body.usePlatformDefault ? null : work.selectedProviderId;
    const next = await createGenerationJob({
      id: crypto.randomUUID(),
      workId: work.id,
      ownerId: auth.user.id,
      providerSnapshotJson: JSON.stringify(await providerSnapshotFor(auth.user.id, providerId)),
    });
    await enqueueGeneration({ jobId: next.id, workId: work.id });
    return Response.json({ job: jobDto(next) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
