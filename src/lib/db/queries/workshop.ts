import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { db } from "../client";
import {
  workshopPosts,
  workshopVotes,
  type WorkshopPostRow,
} from "../schema/workshop";

// 热度加权：点赞权重高，同时给新内容衰减式初始曝光，避免老内容永久霸榜。
// hot = likeCount * 2 + max(0, 48 - ageHours) * 0.15
// —— 发布 48 小时内有递减的「新鲜度加成」，之后完全靠点赞。
function computeHot(likeCount: number, createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000;
  const freshness = Math.max(0, 48 - ageHours) * 0.15;
  return likeCount * 2 + freshness;
}

export interface PublishInput {
  id: string;
  storyId: string;
  storyTitle: string;
  anchorParagraph: number;
  enterHint?: string | null;
  kind: string;
  authorId: string;
  authorName?: string | null;
  title: string;
  body: string;
  // 接力盖楼：续写在哪条 post 之后。为空 = 新开一条链的起点。
  parentPostId?: string | null;
}

// 发布一条改写到工坊；若是接力续写，则继承 rootPostId 并 depth+1。
export async function publishPost(
  input: PublishInput,
): Promise<WorkshopPostRow> {
  let rootPostId = input.id;
  let depth = 0;
  if (input.parentPostId) {
    const parent = await db
      .select()
      .from(workshopPosts)
      .where(eq(workshopPosts.id, input.parentPostId))
      .limit(1);
    if (parent[0]) {
      rootPostId = parent[0].rootPostId;
      depth = parent[0].depth + 1;
    }
  }
  const createdAt = new Date();
  const rows = await db
    .insert(workshopPosts)
    .values({
      id: input.id,
      storyId: input.storyId,
      storyTitle: input.storyTitle,
      anchorParagraph: input.anchorParagraph,
      enterHint: input.enterHint ?? null,
      kind: input.kind,
      authorId: input.authorId,
      authorName: input.authorName ?? null,
      title: input.title,
      body: input.body,
      parentPostId: input.parentPostId ?? null,
      rootPostId,
      depth,
      likeCount: 0,
      hotScore: computeHot(0, createdAt),
      createdAt,
    })
    .returning();
  return rows[0];
}

export interface PostWithVote extends WorkshopPostRow {
  liked?: boolean;
}

// 给一批 post 附加「当前用户是否点过赞」
async function attachVoteState(
  rows: WorkshopPostRow[],
  userId: string | null,
): Promise<PostWithVote[]> {
  if (!userId || rows.length === 0) return rows.map((r) => ({ ...r, liked: false }));
  const ids = rows.map((r) => r.id);
  const voted = await db
    .select({ postId: workshopVotes.postId })
    .from(workshopVotes)
    .where(
      and(
        eq(workshopVotes.userId, userId),
        inArray(workshopVotes.postId, ids),
      ),
    );
  const set = new Set(voted.map((v) => v.postId));
  return rows.map((r) => ({ ...r, liked: set.has(r.id) }));
}

// 全站总榜：按热度排序的链首（depth=0）改写。
export async function listHallTop(
  userId: string | null,
  limit = 30,
): Promise<PostWithVote[]> {
  const rows = await db
    .select()
    .from(workshopPosts)
    .where(eq(workshopPosts.depth, 0))
    .orderBy(desc(workshopPosts.hotScore), desc(workshopPosts.createdAt))
    .limit(limit);
  return attachVoteState(rows, userId);
}

// 某个名场面（作品 + 入局点段落）下的所有链首改写，按热度排序。
export async function listSceneTop(
  storyId: string,
  anchorParagraph: number,
  userId: string | null,
  limit = 30,
): Promise<PostWithVote[]> {
  const rows = await db
    .select()
    .from(workshopPosts)
    .where(
      and(
        eq(workshopPosts.storyId, storyId),
        eq(workshopPosts.anchorParagraph, anchorParagraph),
        eq(workshopPosts.depth, 0),
      ),
    )
    .orderBy(desc(workshopPosts.hotScore), desc(workshopPosts.createdAt))
    .limit(limit);
  return attachVoteState(rows, userId);
}

// 一条接力链的完整盖楼（含链首），按楼层升序。
export async function listChain(
  rootPostId: string,
  userId: string | null,
): Promise<PostWithVote[]> {
  const rows = await db
    .select()
    .from(workshopPosts)
    .where(eq(workshopPosts.rootPostId, rootPostId))
    .orderBy(workshopPosts.depth, workshopPosts.createdAt);
  return attachVoteState(rows, userId);
}

export async function getPost(id: string): Promise<WorkshopPostRow | null> {
  const rows = await db
    .select()
    .from(workshopPosts)
    .where(eq(workshopPosts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// 点赞/取消点赞（幂等）；返回最新点赞数与是否已赞。
export async function toggleVote(
  postId: string,
  userId: string,
  voteId: string,
): Promise<{ likeCount: number; liked: boolean } | null> {
  const post = await getPost(postId);
  if (!post) return null;

  const existing = await db
    .select({ id: workshopVotes.id })
    .from(workshopVotes)
    .where(
      and(eq(workshopVotes.postId, postId), eq(workshopVotes.userId, userId)),
    )
    .limit(1);

  let liked: boolean;
  if (existing[0]) {
    await db.delete(workshopVotes).where(eq(workshopVotes.id, existing[0].id));
    liked = false;
  } else {
    await db
      .insert(workshopVotes)
      .values({ id: voteId, postId, userId })
      .onConflictDoNothing();
    liked = true;
  }

  // 重新统计该 post 的点赞数并刷新热度
  const cnt = await db
    .select({ n: sql<number>`count(*)` })
    .from(workshopVotes)
    .where(eq(workshopVotes.postId, postId));
  const likeCount = cnt[0]?.n ?? 0;
  await db
    .update(workshopPosts)
    .set({ likeCount, hotScore: computeHot(likeCount, post.createdAt) })
    .where(eq(workshopPosts.id, postId));

  return { likeCount, liked };
}

// 某条链上一共盖了几楼、总赞数（殿堂列表展示用）
export async function chainStats(
  rootIds: string[],
): Promise<Map<string, { floors: number; totalLikes: number }>> {
  const map = new Map<string, { floors: number; totalLikes: number }>();
  if (rootIds.length === 0) return map;
  const rows = await db
    .select({
      rootPostId: workshopPosts.rootPostId,
      floors: sql<number>`count(*)`,
      totalLikes: sql<number>`coalesce(sum(${workshopPosts.likeCount}), 0)`,
    })
    .from(workshopPosts)
    .where(inArray(workshopPosts.rootPostId, rootIds))
    .groupBy(workshopPosts.rootPostId);
  for (const r of rows) {
    map.set(r.rootPostId, { floors: r.floors, totalLikes: r.totalLikes });
  }
  return map;
}
