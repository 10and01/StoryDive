import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listBranches,
  listBranchesForStory,
  createBranch,
} from "@/lib/db/queries/branches";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const storyId = request.nextUrl.searchParams.get("storyId");
  const rows = storyId
    ? await listBranchesForStory(auth.user.id, storyId)
    : await listBranches(auth.user.id);
  return Response.json({ branches: rows });
}

const VALID_KINDS = new Set(["dialogue", "fork", "rewrite"]);

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { storyId, storyTitle, kind, anchorParagraph, parentId, title, body: text } = body;

  if (
    typeof storyId !== "string" ||
    typeof storyTitle !== "string" ||
    !VALID_KINDS.has(kind as string) ||
    typeof title !== "string" ||
    typeof text !== "string"
  ) {
    return Response.json({ error: "Invalid branch payload" }, { status: 400 });
  }

  const row = await createBranch({
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId: auth.user.id,
    storyId,
    storyTitle,
    kind: kind as string,
    anchorParagraph: typeof anchorParagraph === "number" && Number.isFinite(anchorParagraph) ? anchorParagraph : 0,
    parentId: typeof parentId === "string" && parentId ? parentId : null,
    title,
    body: text,
  });

  return Response.json({ branch: row }, { status: 201 });
}
