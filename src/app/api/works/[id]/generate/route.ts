import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createGenerationJob, getModelProvider, getWork, updateWorkOwned } from "@/lib/db/queries/custom-works";
import { enqueueGeneration, providerSnapshotFor } from "@/lib/works/generation";
import { errorResponse, jobDto } from "@/lib/works/api";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await context.params;
    const work = await getWork(id);
    if (!work || work.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { providerId?: string | null };
    const providerId =
      body.providerId === undefined
        ? work.selectedProviderId
        : typeof body.providerId === "string"
          ? body.providerId.slice(0, 80)
          : null;
    if (providerId && !(await getModelProvider(providerId, auth.user.id))) {
      return Response.json({ error: "provider_not_found" }, { status: 404 });
    }
    if (body.providerId !== undefined) {
      await updateWorkOwned(work.id, auth.user.id, { selectedProviderId: providerId || null });
    }
    const job = await createGenerationJob({
      id: crypto.randomUUID(),
      workId: work.id,
      ownerId: auth.user.id,
      providerSnapshotJson: JSON.stringify(await providerSnapshotFor(auth.user.id, providerId)),
    });
    await enqueueGeneration({ jobId: job.id, workId: work.id });
    return Response.json({ job: jobDto(job) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
