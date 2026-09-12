import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, makeGuestPayload, readSessionCookie, sessionCookieParams, signSession } from "@/lib/auth/session";

// 游客兜底：首次访问（无会话 Cookie）时自动发一个签名游客会话，
// 保证投票、创作、剧场等全流程 Demo 永不因登录被拦空场。
// 配置知乎 OAuth 后，用户可点「知乎登录」升级为正式账号。
export async function middleware(request: NextRequest) {
  if (readSessionCookie(request)) return NextResponse.next();

  const session = await signSession(makeGuestPayload());
  const requestHeaders = new Headers(request.headers);
  // 让本次请求内的 API 路由立刻能读到会话（Cookie 要等响应才会落盘）
  requestHeaders.set("cookie", `${SESSION_COOKIE}=${session}`);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE, session, sessionCookieParams());
  return response;
}

export const config = {
  // 静态资源与本地图片不进 middleware
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
