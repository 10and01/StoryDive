import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listChain } from "@/lib/db/queries/workshop";

// GET /api/workshop/chain/[rootId]  读取一条接力盖楼链（含链首，按楼层）。公开可读。
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rootId: string }> },
) {
  const { rootId } = await params;
  const auth = await requireAuth(request);
  const userId = auth.ok ? auth.user.id : null;
  const posts = await listChain(rootId, userId);
  return Response.json({ posts });
}
