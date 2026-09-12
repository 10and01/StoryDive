import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  publishPost,
  listHallTop,
  listSceneTop,
} from "@/lib/db/queries/workshop";

const VALID_KINDS = new Set(["dialogue", "fork", "rewrite"]);

// GET /api/workshop
//   ?scope=top                         全站总榜（链首，按热度）
//   ?storyId=xxx&anchor=7              某名场面（入局点）下的改写榜
// 公开可读；带登录态时附加「当前用户是否点过赞」。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  const userId = auth.ok ? auth.user.id : null;

  const sp = request.nextUrl.searchParams;
  const storyId = sp.get("storyId");
  const anchor = sp.get("anchor");

  if (storyId && anchor !== null) {
    const posts = await listSceneTop(
      storyId,
      Number.parseInt(anchor, 10) || 0,
      userId,
    );
    return Response.json({ posts });
  }

  const posts = await listHallTop(userId);
  return Response.json({ posts });
}

// POST /api/workshop  发布一条改写到工坊（登录必需）；parentPostId 存在则为接力盖楼。
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const {
    storyId,
    storyTitle,
    anchorParagraph,
    enterHint,
    kind,
    title,
    body: text,
    parentPostId,
  } = body;

  if (
    typeof storyId !== "string" ||
    typeof storyTitle !== "string" ||
    typeof title !== "string" ||
    typeof text !== "string" ||
    !text.trim()
  ) {
    return Response.json({ error: "Invalid post payload" }, { status: 400 });
  }

  const row = await publishPost({
    id: `wp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    storyId,
    storyTitle,
    anchorParagraph: typeof anchorParagraph === "number" && Number.isFinite(anchorParagraph) ? anchorParagraph : 0,
    enterHint: typeof enterHint === "string" ? enterHint : null,
    kind: VALID_KINDS.has(kind as string) ? (kind as string) : "rewrite",
    authorId: auth.user.id,
    authorName: auth.user.name?.trim() || auth.user.email?.split("@")[0] || null,
    title,
    body: text,
    parentPostId:
      typeof parentPostId === "string" && parentPostId ? parentPostId : null,
  });

  return Response.json({ post: row }, { status: 201 });
}
