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
// opts.real = true 时拒绝游客会话（401 + login_required），用于"体验类"动作接口；
// 浏览预览类接口不带该参数，游客可正常访问。
// 本地测试可用 NEXT_PUBLIC_GUEST_EXPERIENCE=open 放开游客全功能。
// 生产权限只读取服务端 GUEST_EXPERIENCE，避免公开构建变量意外放开写操作。
export async function requireAuth(
  request: Request,
  opts?: { real?: boolean },
): Promise<AuthResult> {
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
  const guestOpen =
    String(process.env.GUEST_EXPERIENCE) === "open" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_GUEST_EXPERIENCE === "open");
  if (opts?.real && payload.guest && !guestOpen) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "login_required",
          code: "login_required",
          message: "该体验需使用知乎账号登录",
        },
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
