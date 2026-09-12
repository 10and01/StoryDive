import { and, eq, desc } from "drizzle-orm";
import { db } from "../client";
import { branches, type BranchRow } from "../schema/branches";

export async function listBranches(userId: string): Promise<BranchRow[]> {
  return db
    .select()
    .from(branches)
    .where(eq(branches.userId, userId))
    .orderBy(desc(branches.createdAt));
}

export async function listBranchesForStory(
  userId: string,
  storyId: string,
): Promise<BranchRow[]> {
  return db
    .select()
    .from(branches)
    .where(and(eq(branches.userId, userId), eq(branches.storyId, storyId)))
    .orderBy(desc(branches.createdAt));
}

export async function createBranch(data: {
  id: string;
  userId: string;
  storyId: string;
  storyTitle: string;
  kind: string;
  anchorParagraph: number;
  parentId?: string | null;
  title: string;
  body: string;
}): Promise<BranchRow> {
  const rows = await db.insert(branches).values(data).returning();
  return rows[0];
}

export async function deleteBranch(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(branches)
    .where(and(eq(branches.userId, userId), eq(branches.id, id)))
    .returning({ id: branches.id });
  return rows.length > 0;
}
