import { NextRequest } from "next/server";

// 分享海报专用图片代理：远程 CDN（cdn.eazo.ai）不返回 CORS 头，
// 浏览器端用 crossOrigin="anonymous" 直接加载会跨域失败、无法画进 canvas。
// 这里在服务端取回图片，再以同源身份返回，海报 canvas 便可安全绘制、导出。
const ALLOWED_HOSTS = new Set(["cdn.eazo.ai"]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return new Response("missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  // 只允许代理受信任的 CDN，防止 SSRF
  if (
    (target.protocol !== "https:" && target.protocol !== "http:") ||
    !ALLOWED_HOSTS.has(target.hostname)
  ) {
    return new Response("host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      // 服务端取原图，去掉任何 query 缓存标记
      headers: { Accept: "image/*" },
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("upstream error", { status: 502 });
    }
    const contentType =
      upstream.headers.get("content-type") ?? "image/png";
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 同源返回，海报 canvas 无需 CORS 即可读取像素；显式带 ACAO 兜底边界情况
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
