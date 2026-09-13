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
// 3) 用黑客松基础信息接口取 hash_id/昵称/头像（旧内容条目法兜底）→
// 4) 下发签名会话 Cookie。
const TOKEN_ENDPOINT = "https://openapi.zhihu.com/access_token";
const USER_PROFILE_ENDPOINT = "https://openapi.zhihu.com/user";
const USER_CONTENTS_ENDPOINT = "https://developer.zhihu.com/api/v1/user/contents";

interface ZhihuProfile {
  id: string | null; // 平台稳定标识（hash_id 优先，uid 十进制串兜底）
  name: string | null;
  avatarUrl: string | null;
}

async function fetchZhihuProfile(oauthToken: string): Promise<ZhihuProfile> {
  // 主路径：GET /user（见 skill 0.7.2 references/hackathon-user-profile-api.md）。
  // 只需 OAuth token；uid 是 int64，用正则从原文无损提取十进制串，不经过 Number。
  // 注意 HTTP 200 也可能带业务错误（历史示例 code:404 User don't exist），
  // 必须确认存在有效用户标识才认定成功。
  try {
    const res = await fetch(USER_PROFILE_ENDPOINT, {
      headers: { Authorization: `Bearer ${oauthToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const raw = await res.text();
      const idMatch =
        raw.match(/"hash_id"\s*:\s*"([^"]+)"/) ?? raw.match(/"uid"\s*:\s*(\d+)/);
      let name: string | null = null;
      let avatarUrl: string | null = null;
      try {
        const data = JSON.parse(raw) as { fullname?: string; avatar_path?: string };
        name = data.fullname?.trim() || null;
        avatarUrl = data.avatar_path || null;
      } catch {
        // 响应非 JSON：标识以正则提取为准
      }
      if (idMatch) return { id: idMatch[1], name, avatarUrl };
    }
  } catch {
    // 主路径失败 → 走下方兜底
  }

  // 兜底：从用户最新内容条目里提取 AuthorName / AuthorAvatar；失败可容忍。
  try {
    const secret = process.env.ZHIHU_ACCESS_SECRET;
    if (!secret) return { id: null, name: null, avatarUrl: null };
    const res = await fetch(`${USER_CONTENTS_ENDPOINT}?Limit=1`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-OAuth-Token": oauthToken,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return { id: null, name: null, avatarUrl: null };
    const data = (await res.json()) as {
      Data?: { Items?: Array<{ AuthorName?: string; AuthorAvatar?: string }> };
    };
    const first = data.Data?.Items?.[0];
    return {
      id: null,
      name: first?.AuthorName?.trim() || null,
      avatarUrl: first?.AuthorAvatar || null,
    };
  } catch {
    return { id: null, name: null, avatarUrl: null };
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
    // 诊断：把知乎实际送回的完整查询串带回前端，便于核对平台回调契约
    // （正常应含 authorization_code；为空多半是 redirect_uri 与登记地址不一致或授权被取消）
    const raw = url.search || "(空)";
    return NextResponse.redirect(
      new URL(`/?auth_error=missing_code&raw=${encodeURIComponent(raw)}`, request.url),
    );
  }
  if (!isZhihuOAuthConfigured()) {
    const have = [
      (process.env.ZHIHU_OAUTH_APP_ID || process.env.NEXT_PUBLIC_ZHIHU_OAUTH_APP_ID) && "app_id",
      process.env.ZHIHU_OAUTH_APP_KEY && "app_key",
    ]
      .filter(Boolean)
      .join(",");
    return NextResponse.redirect(
      new URL(`/?auth_error=oauth_not_configured&have=${have || "none"}`, request.url),
    );
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
  // hash_id/uid 是平台稳定标识；拿不到时退回昵称哈希（同名合并，跨登录稳定）
  const userId = profile.id
    ? `zh-${profile.id}`
    : `zh-${(await sha256Hex(profile.name ?? code)).slice(0, 24)}`;

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
