import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGenerationJob } from "@/lib/db/queries/custom-works";
import { jobDto } from "@/lib/works/api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const job = await getGenerationJob(id);
  if (!job || job.ownerId !== auth.user.id) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ job: jobDto(job) });
}
