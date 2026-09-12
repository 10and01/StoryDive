import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteBranch } from "@/lib/db/queries/branches";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ok = await deleteBranch(auth.user.id, id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
