import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ZhihuAuthError } from "@/lib/zhihu/user-data";
import { syncProfileFromZhihu, toFolloweeCards } from "@/lib/profile/sync";
import { fetchUserFollowees } from "@/lib/zhihu/user-data";
import type { FolloweeCard } from "@/lib/profile/types";
import {
  deleteUserProfile,
  getUserProfileRow,
  upsertUserProfile,
} from "@/lib/db/queries/profile";

// POST /api/user/sync  把「你的知乎」同步进画像（登录 + 显式同意必需）。
// 流程：会话里的 OAuth token → 拉创作列表（user/contents，赞同数序 20 条）
// → AI 提炼画像 + 判例卡 → D1 缓存。body.followees=true 时另拉关注列表
// （仅公开资料）存成影子卡，供群像对戏「影子 NPC」使用。
// token 失效返回 reauth_needed，前端引导重新授权。
// DELETE /api/user/sync  一键清除画像与授权数据缓存（撤回同意）。

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    consent?: boolean;
    followees?: boolean;
  };
  if (body.consent !== true) {
    return NextResponse.json(
      { code: "consent_required", message: "需要先同意授权条款" },
      { status: 400 },
    );
  }
  const oauthToken = auth.user.oauthToken;
  if (!oauthToken) {
    // 老会话没有 token（或游客），需要重新走授权登录
    return NextResponse.json({ code: "reauth_needed" }, { status: 401 });
  }

  try {
    const { profile, cards } = await syncProfileFromZhihu(oauthToken);
    const syncedAt = new Date();
    await upsertUserProfile({
      userId: auth.user.id,
      profileJson: profile ? JSON.stringify(profile) : undefined,
      contentsJson: cards.length ? JSON.stringify(cards) : undefined,
      consentContents: true,
      syncedAt,
    });

    // 影子卡：仅当本次显式勾选关注列表授权时拉取（独立同意开关）
    let followeeCards: FolloweeCard[] = [];
    if (body.followees === true) {
      try {
        followeeCards = toFolloweeCards(await fetchUserFollowees(oauthToken, 30));
        await upsertUserProfile({
          userId: auth.user.id,
          followeesJson: followeeCards.length ? JSON.stringify(followeeCards) : null,
          consentFollowees: true,
          syncedAt,
        });
      } catch (error) {
        if (error instanceof ZhihuAuthError) throw error;
        console.error("[user/sync] followees failed:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      profile,
      cards: cards.length,
      followees: followeeCards.length,
      syncedAt: syncedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ZhihuAuthError) {
      return NextResponse.json({ code: "reauth_needed" }, { status: 401 });
    }
    console.error("[user/sync] failed:", error);
    return NextResponse.json({ code: "sync_failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;
  try {
    await deleteUserProfile(auth.user.id);
  } catch (error) {
    console.error("[user/sync] delete failed:", error);
    return NextResponse.json({ code: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// GET /api/user/sync  轻量查询：画像同步状态 + 影子卡（前端决定同步入口/影子选择器）。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.user.guest) {
    return NextResponse.json({ hasProfile: false, consent: false });
  }
  try {
    const row = await getUserProfileRow(auth.user.id);
    let followees: FolloweeCard[] = [];
    if (row?.consentFollowees && row.followeesJson) {
      try {
        const parsed = JSON.parse(row.followeesJson) as FolloweeCard[];
        if (Array.isArray(parsed)) followees = parsed;
      } catch {
        // 影子卡 JSON 损坏 → 空，重新同步可修复
      }
    }
    return NextResponse.json({
      hasProfile: Boolean(row?.profileJson),
      hasCards: Boolean(row?.contentsJson),
      consent: Boolean(row?.consentContents),
      consentFollowees: Boolean(row?.consentFollowees),
      followees,
      syncedAt: row?.syncedAt ? new Date(row.syncedAt).toISOString() : null,
    });
  } catch {
    // 表还没迁移好等场景：静默当作未同步
    return NextResponse.json({ hasProfile: false, consent: false });
  }
}
