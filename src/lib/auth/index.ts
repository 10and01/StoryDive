import { NextResponse } from "next/server";
import {

  makeGuestPayload,
  readSessionCookie,
  sessionCookieParams,
  signSession,
  verifySession,
  type SessionPayload,
  type SessionUser,
} from "./session";

export { SESSION_COOKIE } from "./session";
export type { SessionUser } from "./session";

export type User = SessionUser;
export type AuthResult =
  | { ok: true; user: SessionPayload }
  | { ok: false; response: Response };

// requireAuth 的调用约定（各 API 路由统一）：
// const auth = await requireAuth(request); if (!auth.ok) return auth.response;
export async function requireAuth(request: Request): Promise<AuthResult> {
  const payload = await verifySession(readSessionCookie(request));
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user: payload };
}

// 知乎 OAuth 是否已配置（前端据此显示「知乎登录」按钮）。
export function isZhihuOAuthConfigured(): boolean {
  return Boolean(
    (process.env.ZHIHU_OAUTH_APP_ID || process.env.NEXT_PUBLIC_ZHIHU_OAUTH_APP_ID) &&
      process.env.ZHIHU_OAUTH_APP_KEY,
  );
}

export function oauthAppId(): string | undefined {
  return process.env.ZHIHU_OAUTH_APP_ID || process.env.NEXT_PUBLIC_ZHIHU_OAUTH_APP_ID;
}

export { makeGuestPayload, sessionCookieParams, signSession, verifySession };
