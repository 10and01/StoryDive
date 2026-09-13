import { NextRequest, NextResponse } from "next/server";
import { oauthAppId } from "@/lib/auth";

// GET /api/auth/login —— 跳转知乎授权页（黑客松 OAuth 流程第一步）。
// 授权端点：GET https://openapi.zhihu.com/authorize
export async function GET(request: NextRequest) {
  const appId = oauthAppId();
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY;
  if (!appId || !appKey) {
    // 诊断：带上 Worker 实际看到的变量存在性（只报有无，不含值），
    // 用于区分「面板变量未保存/被部署清掉」与「单个变量缺失」。
    const have = [appId && "app_id", appKey && "app_key"].filter(Boolean).join(",");
    return NextResponse.redirect(
      new URL(
        `/?auth_error=oauth_not_configured&have=${have || "none"}`,
        request.url,
      ),
    );
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
