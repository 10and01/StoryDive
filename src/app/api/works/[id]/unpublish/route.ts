import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { unpublishWork } from "@/lib/db/queries/custom-works";
import { workDto } from "@/lib/works/api";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const work = await unpublishWork(id, auth.user.id);
  if (!work) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ work: workDto(work, { owner: true }) });
}
