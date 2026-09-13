import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { zhihuSearch } from "@/lib/zhihu/search";

// GET /api/user/shadows?topic=  影子客人的冷启动兜底（登录必需）。
// 没同步关注列表（或关注为空）的账号，用站内搜索该话题下的高赞回答作者
// 充当「知乎高赞旅人」——纯公开资料（昵称/头像/回答摘要），无需额外授权。

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const topic = (request.nextUrl.searchParams.get("topic") ?? "").trim().slice(0, 80);
  if (!topic) {
    return Response.json({ error: "Missing topic" }, { status: 400 });
  }

  const hits = await zhihuSearch(topic, 8);
  const seen = new Set<string>();
  const shadows: Array<{
    name: string;
    headline: string;
    url: string;
    avatarUrl?: string;
    followerCount: number;
  }> = [];
  for (const h of hits) {
    const name = h.authorName.trim();
    if (!name || name === "知乎用户" || name.includes("已注销")) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    shadows.push({
      name: name.slice(0, 20),
      headline: `知乎高赞旅人 · ${h.contentText.slice(0, 50)}`,
      url: h.url,
      avatarUrl: h.authorAvatar,
      followerCount: h.voteUpCount,
    });
    if (shadows.length >= 6) break;
  }
  return Response.json({ shadows });
}
