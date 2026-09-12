import { NextRequest, NextResponse } from "next/server";
import { oauthAppId } from "@/lib/auth";

// GET /api/auth/login —— 跳转知乎授权页（黑客松 OAuth 流程第一步）。
// 授权端点：GET https://openapi.zhihu.com/authorize
export async function GET(request: NextRequest) {
  const appId = oauthAppId();
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY;
  if (!appId || !appKey) {
    return NextResponse.redirect(new URL("/?auth_error=oauth_not_configured", request.url));
  }

  const redirectUri =
    process.env.ZHIHU_OAUTH_REDIRECT_URI ||
    new URL("/api/auth/callback", request.url).toString();

  const authorizeUrl = new URL("https://openapi.zhihu.com/authorize");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("app_id", appId);
  authorizeUrl.searchParams.set("response_type", "code");
  // 注意：黑客松实测回调不回传 state（见 zhihu skill 文档），此处仍发送以便平台侧关联。
  authorizeUrl.searchParams.set("state", crypto.randomUUID().replace(/-/g, ""));

  return NextResponse.redirect(authorizeUrl);
}
