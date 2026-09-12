import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { toggleVote } from "@/lib/db/queries/workshop";

// POST /api/workshop/[id]/vote  点赞 / 取消点赞（登录必需，幂等）。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await toggleVote(
    id,
    auth.user.id,
    `wv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  if (!result) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  return Response.json(result);
}
