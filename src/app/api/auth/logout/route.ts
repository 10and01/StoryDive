import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieParams } from "@/lib/auth/session";

// GET /api/auth/logout —— 清除会话 Cookie。
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieParams(), maxAge: 0 });
  return response;
}
