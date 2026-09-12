import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { castVote, tallyCase } from "@/lib/db/queries/court";

// GET /api/court/vote?caseId=xxx  读取某场庭审的红蓝票数（公开可读，带登录态附「我投的一方」）。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  const userId = auth.ok ? auth.user.id : null;
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) return Response.json({ error: "Missing caseId" }, { status: 400 });
  const tally = await tallyCase(caseId, userId);
  return Response.json(tally);
}

// POST /api/court/vote  投票 / 改投（登录必需，一人一票可切换红蓝）。
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { caseId, side } = body;
  if (typeof caseId !== "string" || (side !== "red" && side !== "blue")) {
    return Response.json({ error: "Invalid vote payload" }, { status: 400 });
  }
  const tally = await castVote(
    caseId,
    auth.user.id,
    side,
    `cv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  return Response.json(tally);
}
