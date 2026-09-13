// 知乎用户数据 API（user-api.md）：第三方应用代表已授权用户访问时，
// 在 Access Secret 鉴权头之外追加 X-OAuth-Token（用户 OAuth access_token）。
// 身份模型（user-api.md「身份模型」表）：Bearer 识别调用方，X-OAuth-Token 识别被代表的用户。
// 额度 user_data 组默认 10000/日，充裕；但仍按需少量拉取。
// OAuth token 1 小时过期且无刷新：服务端识别 20001（鉴权失败）抛 ZhihuAuthError，
// 调用方返回 reauth_needed，前端引导重新走授权登录。

import { zhihuHeaders } from "./client";

const CONTENTS_ENDPOINT = "https://developer.zhihu.com/api/v1/user/contents";
const FOLLOWEES_ENDPOINT = "https://developer.zhihu.com/api/v1/user/followees";

/** OAuth token 失效（过期/被顶替/未授权）：需要用户重新走授权登录 */
export class ZhihuAuthError extends Error {
  code = "reauth_needed";
  constructor() {
    super("oauth token expired, re-authorization required");
    this.name = "ZhihuAuthError";
  }
}

interface ZhihuEnvelope {
  Code?: number;
  Message?: string;
  Data?: unknown;
}

// 统一发请求：区分鉴权失败（20001 → 重新授权）、其余非 0 → 记录后静默降级
//（空数据与接口异常在调用方都表现为空列表，这里留一行日志便于生产排查）。
async function oauthGet(
  url: string,
  oauthToken: string,
): Promise<ZhihuEnvelope | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(url, {
      headers: { ...headers, "X-OAuth-Token": oauthToken },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as ZhihuEnvelope | null;
    if (!res.ok || !data) {
      console.warn(`[zhihu/user-data] ${new URL(url).pathname} -> HTTP ${res.status}`);
      return null;
    }
    if (data.Code === 20001) throw new ZhihuAuthError();
    if (data.Code !== 0) {
      console.warn(
        `[zhihu/user-data] ${new URL(url).pathname} -> Code ${data.Code} ${data.Message ?? ""}`,
      );
      return null; // 30001/30002/30003 等：静默降级
    }
    return data;
  } catch (error) {
    if (error instanceof ZhihuAuthError) throw error;
    console.warn(`[zhihu/user-data] ${new URL(url).pathname} -> fetch error`, error);
    return null;
  }
}

// —— 用户创作数据（user/contents）：列表只返回标题+摘要，非全文（user-api.md 明示）——

export interface UserContentItem {
  contentType: string;
  url: string;
  createdAt: number; // 秒级时间戳
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  title: string;
  summary: string;
}

export type ContentsType = "all" | "answer" | "article" | "zvideo" | "pin" | "question";

interface RawContentItem {
  ContentType?: string;
  Url?: string;
  CreatedAt?: number;
  LikeCount?: number;
  CommentCount?: number;
  FavoriteCount?: number;
  Title?: string;
  Summary?: string;
}

// 拉取用户公开创作列表（按赞同数或时间排序，单页最多 50 条）。
// 没写过内容的用户返回 []；鉴权失败抛 ZhihuAuthError。
export async function fetchUserContents(
  oauthToken: string,
  opts?: {
    contentType?: ContentsType;
    sortField?: "like_count" | "ts";
    limit?: number;
  },
): Promise<UserContentItem[]> {
  const type = opts?.contentType ?? "answer";
  const sort = opts?.sortField ?? "like_count";
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 20));
  const url = `${CONTENTS_ENDPOINT}?ContentType=${type}&SortField=${sort}&SortOrder=desc&Limit=${limit}`;
  const data = await oauthGet(url, oauthToken);
  if (!data?.Data) return [];
  const items = (data.Data as { Items?: RawContentItem[] }).Items ?? [];
  const out: UserContentItem[] = [];
  for (const raw of items) {
    if (!raw.Url) continue;
    out.push({
      contentType: raw.ContentType || type,
      url: raw.Url,
      createdAt: typeof raw.CreatedAt === "number" ? raw.CreatedAt : 0,
      likeCount: typeof raw.LikeCount === "number" ? raw.LikeCount : 0,
      commentCount: typeof raw.CommentCount === "number" ? raw.CommentCount : 0,
      favoriteCount: typeof raw.FavoriteCount === "number" ? raw.FavoriteCount : 0,
      title: (raw.Title ?? "").trim(),
      summary: (raw.Summary ?? "").trim(),
    });
  }
  return out;
}

// —— 关注列表（user/followees）：仅公开资料，影子 NPC 的素材 ——

export interface FolloweeItem {
  fullname: string;
  headline: string;
  url: string;
  avatarUrl?: string;
  gender: number; // 0 未知 / 1 女 / 2 男
  followerCount: number;
}

interface RawFolloweeItem {
  Fullname?: string;
  Headline?: string;
  Url?: string;
  AvatarUrl?: string;
  Gender?: number;
  FollowerCount?: number;
}

// 拉取用户关注的人（单页最多 50 条）。鉴权失败抛 ZhihuAuthError。
export async function fetchUserFollowees(
  oauthToken: string,
  limit = 50,
): Promise<FolloweeItem[]> {
  const n = Math.max(1, Math.min(50, limit));
  const data = await oauthGet(`${FOLLOWEES_ENDPOINT}?Limit=${n}`, oauthToken);
  if (!data?.Data) return [];
  const items = (data.Data as { Items?: RawFolloweeItem[] }).Items ?? [];
  const out: FolloweeItem[] = [];
  for (const raw of items) {
    if (!raw.Fullname) continue;
    out.push({
      fullname: raw.Fullname,
      headline: (raw.Headline ?? "").trim(),
      url: raw.Url ?? "",
      avatarUrl: raw.AvatarUrl || undefined,
      gender: typeof raw.Gender === "number" ? raw.Gender : 0,
      followerCount: typeof raw.FollowerCount === "number" ? raw.FollowerCount : 0,
    });
  }
  return out;
}

// —— 近期收藏（user/collections）：冷启动画像的信号源 ——
// 没写过回答的账号往往收藏过内容；「你收藏的回答」同样能点亮画像与判例。

interface RawCollectionItem {
  ContentType?: string;
  Url?: string;
  CreatedAt?: number;
  FavTime?: number;
  LikeCount?: number;
  FavoriteCount?: number;
  Title?: string;
  Summary?: string;
}

export interface UserCollectionItem {
  contentType: string;
  url: string;
  title: string;
  summary: string;
  likeCount: number;
  favoriteCount: number;
  favTime: number; // 秒级时间戳
}

// 拉取用户近期收藏（接口无分页，最多一批 50 条）。鉴权失败抛 ZhihuAuthError。
export async function fetchUserCollections(
  oauthToken: string,
  limit = 20,
): Promise<UserCollectionItem[]> {
  const n = Math.max(1, Math.min(50, limit));
  const data = await oauthGet(`${CONTENTS_ENDPOINT.replace("/contents", "/collections")}?Limit=${n}`, oauthToken);
  if (!data?.Data) return [];
  const items = (data.Data as { Items?: RawCollectionItem[] }).Items ?? [];
  const out: UserCollectionItem[] = [];
  for (const raw of items) {
    if (!raw.Url || !raw.Title) continue;
    out.push({
      contentType: raw.ContentType || "answer",
      url: raw.Url,
      title: (raw.Title ?? "").trim(),
      summary: (raw.Summary ?? "").trim(),
      likeCount: typeof raw.LikeCount === "number" ? raw.LikeCount : 0,
      favoriteCount: typeof raw.FavoriteCount === "number" ? raw.FavoriteCount : 0,
      favTime: typeof raw.FavTime === "number" ? raw.FavTime : 0,
    });
  }
  return out;
}

// —— 用户基础资料（openapi.zhihu.com/user，仅 OAuth token）：headline/description ——
// 冷启动最后一块拼图：没创作没收藏的账号，一句话签名也能提炼出画像底色。

export interface ZhihuUserBrief {
  headline: string;
  description: string;
}

export async function fetchZhihuUserBrief(oauthToken: string): Promise<ZhihuUserBrief | null> {
  const headers = zhihuHeaders();
  if (!headers) return null;
  try {
    const res = await fetch("https://openapi.zhihu.com/user", {
      headers: { Authorization: `Bearer ${oauthToken}` },
      cache: "no-store",
    });
    const raw = await res.text();
    const data = JSON.parse(raw) as { code?: number; headline?: string; description?: string };
    if (!res.ok || (typeof data.code === "number" && data.code !== 20000)) return null;
    const brief = {
      headline: (data.headline ?? "").trim(),
      description: (data.description ?? "").trim(),
    };
    return brief.headline || brief.description ? brief : null;
  } catch {
    return null;
  }
}

// —— 诊断：原始返回码探测（/api/user/sync?debug=1 用）——
// oauthGet 会把非 0 Code 静默降级为空列表，排障时需要看到真实错误码。
export interface UserEndpointProbe {
  endpoint: string;
  httpStatus: number;
  code: number | string | null; // developer.zhihu.com 用 Code，openapi 用 code
  message: string;
  itemCount: number;
  firstTitle?: string;
}

export async function debugUserEndpoints(oauthToken: string): Promise<UserEndpointProbe[]> {
  const headers = zhihuHeaders();
  if (!headers) return [{ endpoint: "config", httpStatus: 0, code: null, message: "ZHIHU_ACCESS_SECRET 未配置", itemCount: 0 }];

  const probe = async (
    endpoint: string,
    url: string,
    withOAuth: boolean,
    itemPath: string[],
  ): Promise<UserEndpointProbe> => {
    try {
      const res = await fetch(url, {
        headers: withOAuth ? { ...headers, "X-OAuth-Token": oauthToken } : { Authorization: `Bearer ${oauthToken}` },
        cache: "no-store",
      });
      const raw = await res.text();
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { endpoint, httpStatus: res.status, code: null, message: `non-JSON: ${raw.slice(0, 80)}`, itemCount: 0 };
      }
      const code = (body.Code ?? body.code ?? null) as number | string | null;
      const message = String(body.Message ?? body.message ?? body.data ?? "");
      let items: unknown[] = [];
      let cur: unknown = body;
      for (const key of itemPath) {
        cur = (cur as Record<string, unknown>)?.[key];
        if (!cur) break;
      }
      if (Array.isArray(cur)) items = cur;
      const firstTitle =
        items.length && typeof items[0] === "object"
          ? String((items[0] as Record<string, unknown>).Title ?? (items[0] as Record<string, unknown>).Fullname ?? "").slice(0, 30)
          : undefined;
      return { endpoint, httpStatus: res.status, code, message: message.slice(0, 80), itemCount: items.length, firstTitle };
    } catch (error) {
      return { endpoint, httpStatus: 0, code: null, message: `fetch error: ${String(error).slice(0, 80)}`, itemCount: 0 };
    }
  };

  return Promise.all([
    probe("user/contents", `${CONTENTS_ENDPOINT}?ContentType=answer&SortField=like_count&Limit=5`, true, ["Data", "Items"]),
    probe("user/collections", `${CONTENTS_ENDPOINT.replace("/contents", "/collections")}?Limit=5`, true, ["Data", "Items"]),
    probe("user/followees", `${FOLLOWEES_ENDPOINT}?Limit=5`, true, ["Data", "Items"]),
    probe("openapi/user", "https://openapi.zhihu.com/user", false, []),
  ]);
}
