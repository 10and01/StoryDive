import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { userCourtProfile } from "@/lib/db/queries/court";

// GET /api/court/profile  当前观众的历史投票画像（难度自适应与立场钩子的数据源）。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const profile = await userCourtProfile(auth.user.id);
  return Response.json({ profile });
}
