"use client";

// 画像同步 API：把「你的知乎」经显式授权同步进画像（判例卡 + AI 提炼 + 影子卡）。
// 状态查询用 GET（决定下拉里入口的亮起态、影子选择器的可用性），
// 同步用 POST（需 consent:true；followees:true 时另拉关注列表），
// 清除用 DELETE（撤回同意）。reauth_needed 表示 OAuth token 过期，需重新登录。

import { request } from "./request";

export interface FolloweeCardDTO {
  name: string;
  headline: string;
  url: string;
  avatarUrl?: string;
  followerCount: number;
}

export interface SyncStatus {
  hasProfile: boolean;
  hasCards?: boolean;
  /** 已存的判例卡数量（重开弹窗时恢复显示用） */
  cardsCount?: number;
  /** 已提炼的画像（重开弹窗时恢复显示用） */
  profile?: SyncProfile | null;
  consent: boolean;
  consentFollowees?: boolean;
  followees?: FolloweeCardDTO[];
  syncedAt?: string | null;
}

export interface SyncProfile {
  keywords: string[];
  interests: string[];
  tone: string;
  summary: string;
}

export async function fetchSyncStatus(): Promise<SyncStatus | null> {
  try {
    const res = await request("/api/user/sync");
    if (!res.ok) return null;
    return (await res.json()) as SyncStatus;
  } catch {
    return null;
  }
}

export type SyncResponse =
  | {
      ok: true;
      profile: SyncProfile | null;
      cards: number;
      followees: number;
      syncedAt: string;
    }
  | { ok: false; code: "reauth_needed" | "consent_required" | "sync_failed" | "empty"; message?: string };

export async function postSync(
  consent: boolean,
  opts?: { followees?: boolean },
): Promise<SyncResponse> {
  try {
    const res = await request("/api/user/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent, followees: opts?.followees === true }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok === true) {
      return {
        ok: true,
        profile: (data.profile as SyncProfile | null) ?? null,
        cards: Number(data.cards) || 0,
        followees: Number(data.followees) || 0,
        syncedAt: String(data.syncedAt ?? ""),
      };
    }
    const code = String(data.code ?? "sync_failed");
    return { ok: false, code: code as "reauth_needed", message: data.message as string | undefined };
  } catch {
    return { ok: false, code: "sync_failed" };
  }
}

export async function deleteSync(): Promise<boolean> {
  try {
    const res = await request("/api/user/sync", { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
