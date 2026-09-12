import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieParams,
  signSession,
  type SessionPayload,
} from "@/lib/auth/session";
import { isZhihuOAuthConfigured, oauthAppId } from "@/lib/auth";
import { upsertUser } from "@/lib/db/queries";

// GET /api/auth/callback —— 知乎授权回调：
// 1) 读 authorization_code（兼容 code）→ 2) 换 access_token →
// 3) 用 Access Secret + X-OAuth-Token 取用户昵称/头像 → 4) 下发签名会话 Cookie。
const TOKEN_ENDPOINT = "https://openapi.zhihu.com/access_token";
const USER_CONTENTS_ENDPOINT = "https://developer.zhihu.com/api/v1/user/contents";

async function fetchZhihuProfile(oauthToken: string): Promise<{ name: string | null; avatarUrl: string | null }> {
  // 黑客松没有独立的“用户信息”端点（见 skill 文档协议待确认项），
  // 从用户最新内容条目里提取 AuthorName / AuthorAvatar 作为展示信息；失败可容忍。
  try {
    const secret = process.env.ZHIHU_ACCESS_SECRET;
    if (!secret) return { name: null, avatarUrl: null };
    const res = await fetch(`${USER_CONTENTS_ENDPOINT}?Limit=1`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-OAuth-Token": oauthToken,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return { name: null, avatarUrl: null };
    const data = (await res.json()) as {
      Data?: { Items?: Array<{ AuthorName?: string; AuthorAvatar?: string }> };
    };
    const first = data.Data?.Items?.[0];
    return { name: first?.AuthorName?.trim() || null, avatarUrl: first?.AuthorAvatar || null };
  } catch {
    return { name: null, avatarUrl: null };
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", request.url));
  }
  if (!isZhihuOAuthConfigured()) {
    return NextResponse.redirect(new URL("/?auth_error=oauth_not_configured", request.url));
  }

  const appId = oauthAppId()!;
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY!;
  const redirectUri =
    process.env.ZHIHU_OAUTH_REDIRECT_URI ||
    new URL("/api/auth/callback", request.url).toString();

  // 换取 OAuth Token：表单字段固定为 grant_type + code（不要改成 authorization_code）
  let accessToken: string | undefined;
  let expiresIn = 0;
  try {
    const body = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number }
      | null;
    // 成功判定以 access_token 是否存在为准（业务 code: 20000 语义不可靠）
    if (data?.access_token) {
      accessToken = data.access_token;
      expiresIn = data.expires_in ?? 0;
    }
  } catch {
    // 落到下方统一错误处理
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL("/?auth_error=token_exchange_failed", request.url));
  }

  const profile = await fetchZhihuProfile(accessToken);
  // 无独立用户 id 端点：以昵称哈希作为站内稳定 id（同名合并，跨登录稳定）
  const userId = `zh-${(await sha256Hex(profile.name ?? code)).slice(0, 24)}`;

  const payload: SessionPayload = {
    id: userId,
    name: profile.name ?? "知乎旅人",
    avatarUrl: profile.avatarUrl,
    oauthToken: accessToken,
    exp:
      expiresIn > 0
        ? Math.floor(Date.now() / 1000) + Math.min(expiresIn, 180 * 24 * 3600)
        : Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  };

  // 用户资料落库（后台执行，不阻塞登录跳转）
  upsertUser({
    id: userId,
    name: payload.name,
    avatarUrl: payload.avatarUrl,
  }).catch((err) => console.error("[auth/callback] upsertUser failed", err));

  const token = await signSession(payload);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieParams());
  return response;
}
