import { type NextRequest, NextResponse } from "next/server";
import { isZhihuOAuthConfigured, requireAuth } from "@/lib/auth";
import { upsertUser } from "@/lib/db/queries";

/**
 * GET /api/user/profile
 * 返回当前会话用户（知乎登录或游客），并 best-effort 落库。
 * 响应带 oauthConfigured，前端据此决定是否展示「知乎登录」入口。
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { user } = auth;

  // Upsert in the background — don't block the response on DB latency.
  upsertUser({
    id: user.id,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  }).catch((err) => {
    console.error("[profile] upsertUser failed", err);
  });

  return NextResponse.json({
    ok: true,
    user,
    oauthConfigured: isZhihuOAuthConfigured(),
  });
}
