"use client";

import { getResolvedLocale } from "@/i18n";
import { appAIRequest } from "@/lib/api/app-ai-request";

/**
 * 统一的同源 fetch 封装：自动附带语言偏好头，并接管 AI 不可用的 402 toast。
 * 会话凭据走 HttpOnly Cookie，浏览器自动携带，无需手动注入请求头。
 */
export async function request(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-app-locale", getResolvedLocale());

  return appAIRequest(input, {
    ...init,
    headers,
  });
}
