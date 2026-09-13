import { eq } from "drizzle-orm";
import { db } from "../client";
import { userProfiles } from "../schema/profile";
import type { UserProfileRow } from "../schema/profile";

// 画像行的读取与维护：全部 best-effort，调用方自行降级（画像只是增强项）。

export async function getUserProfileRow(userId: string): Promise<UserProfileRow | null> {
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export interface UpsertProfileInput {
  userId: string;
  profileJson?: string | null;
  contentsJson?: string | null;
  followeesJson?: string | null;
  consentContents?: boolean;
  consentFollowees?: boolean;
  syncedAt?: Date;
}

// 部分更新：只覆盖传入的字段（undefined = 不动，null = 清空）。
export async function upsertUserProfile(input: UpsertProfileInput): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };
  if (input.profileJson !== undefined) set.profileJson = input.profileJson;
  if (input.contentsJson !== undefined) set.contentsJson = input.contentsJson;
  if (input.followeesJson !== undefined) set.followeesJson = input.followeesJson;
  if (input.consentContents !== undefined) set.consentContents = input.consentContents;
  if (input.consentFollowees !== undefined) set.consentFollowees = input.consentFollowees;
  if (input.syncedAt) set.syncedAt = input.syncedAt;

  await db
    .insert(userProfiles)
    .values({
      userId: input.userId,
      profileJson: (set.profileJson as string | null | undefined) ?? null,
      contentsJson: (set.contentsJson as string | null | undefined) ?? null,
      followeesJson: (set.followeesJson as string | null | undefined) ?? null,
      consentContents: input.consentContents ?? false,
      consentFollowees: input.consentFollowees ?? false,
      syncedAt: input.syncedAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: userProfiles.userId, set });
}

// 一键清除：删掉画像与全部授权数据缓存（同意撤回）。
export async function deleteUserProfile(userId: string): Promise<void> {
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}
