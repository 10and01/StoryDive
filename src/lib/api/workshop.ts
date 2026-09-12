import { request } from "./request";

// 工坊改写帖（前端视图模型；服务端 Drizzle 推断为 camelCase 键）
export interface WorkshopPost {
  id: string;
  storyId: string;
  storyTitle: string;
  anchorParagraph: number;
  enterHint: string | null;
  kind: string;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  parentPostId: string | null;
  rootPostId: string;
  depth: number;
  likeCount: number;
  hotScore: number;
  createdAt: string;
  liked?: boolean;
}

export interface PublishInput {
  storyId: string;
  storyTitle: string;
  anchorParagraph: number;
  enterHint?: string | null;
  kind?: string;
  title: string;
  body: string;
  parentPostId?: string | null;
}

// 全站总榜
export async function fetchHallTop(): Promise<WorkshopPost[]> {
  const res = await request("/api/workshop?scope=top", { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { posts: WorkshopPost[] };
  return data.posts;
}

// 某名场面（入局点）下的改写榜
export async function fetchSceneTop(
  storyId: string,
  anchor: number,
): Promise<WorkshopPost[]> {
  const res = await request(
    `/api/workshop?storyId=${encodeURIComponent(storyId)}&anchor=${anchor}`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { posts: WorkshopPost[] };
  return data.posts;
}

// 一条接力盖楼链
export async function fetchChain(rootId: string): Promise<WorkshopPost[]> {
  const res = await request(
    `/api/workshop/chain/${encodeURIComponent(rootId)}`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { posts: WorkshopPost[] };
  return data.posts;
}

// 发布 / 接力续写（parentPostId 存在即为接力）
export async function publishToWorkshop(
  input: PublishInput,
): Promise<WorkshopPost> {
  const res = await request("/api/workshop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { post: WorkshopPost };
  return data.post;
}

// 点赞 / 取消点赞
export async function toggleVote(
  postId: string,
): Promise<{ likeCount: number; liked: boolean }> {
  const res = await request(
    `/api/workshop/${encodeURIComponent(postId)}/vote`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { likeCount: number; liked: boolean };
}
