"use client";

import { request } from "./request";

export interface UserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  /** 游客会话标记（未走知乎登录时由 middleware 自动发放） */
  guest?: boolean;
}

export interface ProfileResult {
  user: UserProfile | null;
  oauthConfigured: boolean;
}

export async function fetchUserProfile(): Promise<ProfileResult> {
  try {
    const res = await request("/api/user/profile");
    if (!res.ok) return { user: null, oauthConfigured: false };
    const json = (await res.json()) as {
      ok: boolean;
      user: UserProfile;
      oauthConfigured?: boolean;
    };
    return json.ok
      ? { user: json.user, oauthConfigured: json.oauthConfigured ?? false }
      : { user: null, oauthConfigured: false };
  } catch {
    return { user: null, oauthConfigured: false };
  }
}
