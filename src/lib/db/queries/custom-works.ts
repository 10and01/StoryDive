import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  customPlayEvents,
  customPlaySessions,
  customWorks,
  customWorkVersions,
  modelProviders,
  storyGenerationJobs,
  type CustomWorkRow,
  type ModelProviderRow,
} from "../schema/custom-works";
import type { WorkAccessContext, WorkVisibility } from "@/lib/works/types";

export interface CreateWorkInput {
  id: string;
  ownerId: string;
  ownerName?: string | null;
  title: string;
  description?: string;
  tagsJson?: string;
  themePrompt?: string | null;
  sourceFormat: string;
  sourceFileName: string;
  sourceObjectKey: string;
  selectedProviderId?: string | null;
}

export async function createWork(input: CreateWorkInput): Promise<CustomWorkRow> {
  const [row] = await db.insert(customWorks).values({
    ...input,
    description: input.description ?? "",
    tagsJson: input.tagsJson ?? "[]",
    themePrompt: input.themePrompt ?? null,
    selectedProviderId: input.selectedProviderId ?? null,
    status: "processing",
  }).returning();
  return row;
}

export async function getWork(id: string): Promise<CustomWorkRow | null> {
  const rows = await db.select().from(customWorks).where(eq(customWorks.id, id)).limit(1);
  return rows[0] ?? null;
}

export function canAccessWork(work: CustomWorkRow, access: WorkAccessContext): boolean {
  if (work.status === "archived") return false;
  if (access.userId && access.userId === work.ownerId) return true;
  if (work.visibility === "public" && work.publishedVersionId) return true;
  return Boolean(
    work.visibility === "unlisted" &&
      work.publishedVersionId &&
      access.shareToken &&
      access.shareToken === work.shareToken,
  );
}

export async function listUserWorks(ownerId: string): Promise<CustomWorkRow[]> {
  return db.select().from(customWorks).where(
    and(eq(customWorks.ownerId, ownerId), ne(customWorks.status, "archived")),
  ).orderBy(desc(customWorks.updatedAt));
}

export async function listPublicWorks(input: {
  query?: string;
  tag?: string;
  sort?: "latest" | "popular";
  limit?: number;
}): Promise<CustomWorkRow[]> {
  const conditions = [
    eq(customWorks.visibility, "public"),
    eq(customWorks.status, "ready"),
    sql`${customWorks.publishedVersionId} is not null`,
  ];
  const query = input.query?.trim();
  if (query) {
    conditions.push(
      or(
        like(customWorks.title, `%${query}%`),
        like(customWorks.description, `%${query}%`),
        like(customWorks.tagsJson, `%${query}%`),
      )!,
    );
  }
  if (input.tag?.trim()) conditions.push(like(customWorks.tagsJson, `%${input.tag.trim()}%`));
  const order = input.sort === "popular"
    ? [desc(sql<number>`(select count(*) from custom_play_sessions where custom_play_sessions.work_id = ${customWorks.id})`), desc(customWorks.publishedAt)]
    : [desc(customWorks.publishedAt), desc(customWorks.updatedAt)];
  return db.select().from(customWorks).where(and(...conditions)).orderBy(...order).limit(
    Math.min(Math.max(input.limit ?? 24, 1), 60),
  );
}

export async function claimGenerationJob(id: string) {
  const [row] = await db.update(storyGenerationJobs).set({
    status: "parsing",
    stage: "parsing_source",
    progress: 10,
    attemptCount: sql`${storyGenerationJobs.attemptCount} + 1`,
    errorCode: null,
    errorMessage: null,
    updatedAt: new Date(),
  }).where(and(eq(storyGenerationJobs.id, id), eq(storyGenerationJobs.status, "queued"))).returning();
  return row ?? null;
}

export async function updateWorkOwned(
  id: string,
  ownerId: string,
  updates: Partial<typeof customWorks.$inferInsert>,
): Promise<CustomWorkRow | null> {
  const [row] = await db.update(customWorks).set({ ...updates, updatedAt: new Date() }).where(
    and(eq(customWorks.id, id), eq(customWorks.ownerId, ownerId)),
  ).returning();
  return row ?? null;
}

export async function archiveWork(id: string, ownerId: string): Promise<CustomWorkRow | null> {
  return updateWorkOwned(id, ownerId, {
    status: "archived",
    visibility: "private",
    shareToken: null,
    publishedVersionId: null,
    archivedAt: new Date(),
  });
}

export async function createGenerationJob(input: {
  id: string;
  workId: string;
  ownerId: string;
  providerSnapshotJson?: string | null;
}): Promise<typeof storyGenerationJobs.$inferSelect> {
  const [row] = await db.insert(storyGenerationJobs).values({
    ...input,
    providerSnapshotJson: input.providerSnapshotJson ?? null,
    status: "queued",
    stage: "queued",
    progress: 0,
  }).returning();
  await updateWorkOwned(input.workId, input.ownerId, { status: "processing" });
  return row;
}

export async function getGenerationJob(id: string) {
  const rows = await db.select().from(storyGenerationJobs).where(eq(storyGenerationJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestGenerationJob(workId: string) {
  const rows = await db.select().from(storyGenerationJobs).where(eq(storyGenerationJobs.workId, workId))
    .orderBy(desc(storyGenerationJobs.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function updateGenerationJob(
  id: string,
  updates: Partial<typeof storyGenerationJobs.$inferInsert>,
) {
  const [row] = await db.update(storyGenerationJobs).set({ ...updates, updatedAt: new Date() })
    .where(eq(storyGenerationJobs.id, id)).returning();
  return row ?? null;
}

export async function nextVersionNumber(workId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`coalesce(max(${customWorkVersions.versionNumber}), 0)` })
    .from(customWorkVersions).where(eq(customWorkVersions.workId, workId));
  return Number(rows[0]?.max ?? 0) + 1;
}

export async function saveGeneratedVersion(input: {
  id: string;
  workId: string;
  generationJobId: string;
  storyJson: string;
  versionNumber: number;
}) {
  const existing = await db.select().from(customWorkVersions)
    .where(eq(customWorkVersions.generationJobId, input.generationJobId)).limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db.insert(customWorkVersions).values(input).onConflictDoNothing().returning();
  const version = row ?? (await db.select().from(customWorkVersions)
    .where(eq(customWorkVersions.generationJobId, input.generationJobId)).limit(1))[0];
  return version;
}

export async function getVersion(id: string) {
  const rows = await db.select().from(customWorkVersions).where(eq(customWorkVersions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestVersion(workId: string) {
  const rows = await db.select().from(customWorkVersions).where(eq(customWorkVersions.workId, workId))
    .orderBy(desc(customWorkVersions.versionNumber)).limit(1);
  return rows[0] ?? null;
}

export async function publishWork(input: {
  id: string;
  ownerId: string;
  visibility: WorkVisibility;
  shareToken: string | null;
  versionId: string;
}) {
  return updateWorkOwned(input.id, input.ownerId, {
    visibility: input.visibility,
    shareToken: input.shareToken,
    status: "ready",
    publishedVersionId: input.versionId,
    rightsConfirmed: true,
    rightsConfirmedAt: new Date(),
    rightsConfirmedBy: input.ownerId,
    safetyStatus: "passed",
    publishedAt: new Date(),
  });
}

export async function unpublishWork(id: string, ownerId: string) {
  return updateWorkOwned(id, ownerId, {
    visibility: "private",
    shareToken: null,
    publishedVersionId: null,
    publishedAt: null,
  });
}

export async function createCopiedWork(input: {
  id: string;
  versionId: string;
  ownerId: string;
  ownerName?: string | null;
  source: CustomWorkRow;
  sourceObjectKey: string;
  storyJson: string;
}) {
  const now = new Date();
  await db.insert(customWorks).values({
    id: input.id,
    ownerId: input.ownerId,
    ownerName: input.ownerName ?? null,
    title: `${input.source.title} · 副本`,
    description: input.source.description,
    tagsJson: input.source.tagsJson,
    coverImage: input.source.coverImage,
    sourceFormat: input.source.sourceFormat,
    sourceFileName: input.source.sourceFileName,
    sourceObjectKey: input.sourceObjectKey,
    sourceOwnerId: input.source.ownerId,
    sourceWorkId: input.source.id,
    sourceWorkTitle: input.source.title,
    visibility: "private",
    status: "ready",
    safetyStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(customWorkVersions).values({
    id: input.versionId,
    workId: input.id,
    versionNumber: 1,
    storyJson: input.storyJson,
  });
  return getWork(input.id);
}

export async function getPlaySession(workId: string, userId: string) {
  const rows = await db.select().from(customPlaySessions).where(
    and(eq(customPlaySessions.workId, workId), eq(customPlaySessions.userId, userId)),
  ).limit(1);
  return rows[0] ?? null;
}

export async function savePlayProgress(input: {
  workId: string;
  versionId: string;
  userId: string;
  currentChapter: number;
  currentParagraph: number;
  progressJson: string;
  stateJson: string;
  eventKind?: string;
  eventPayloadJson?: string;
}) {
  const existing = await getPlaySession(input.workId, input.userId);
  const id = existing?.id ?? crypto.randomUUID();
  const values = {
    id,
    workId: input.workId,
    versionId: input.versionId,
    userId: input.userId,
    currentChapter: input.currentChapter,
    currentParagraph: input.currentParagraph,
    progressJson: input.progressJson,
    stateJson: input.stateJson,
    updatedAt: new Date(),
  };
  await db.insert(customPlaySessions).values(values).onConflictDoUpdate({
    target: [customPlaySessions.workId, customPlaySessions.userId],
    set: values,
  });
  if (input.eventKind) {
    await db.insert(customPlayEvents).values({
      id: crypto.randomUUID(),
      sessionId: id,
      kind: input.eventKind,
      payloadJson: input.eventPayloadJson ?? "{}",
    });
  }
  return getPlaySession(input.workId, input.userId);
}

export function publicProvider(row: ModelProviderRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    baseUrl: row.baseUrl,
    maskedApiKey: row.maskedApiKey,
    model: row.model,
    isDefault: row.isDefault,
    status: row.status,
    lastTestedAt: row.lastTestedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listModelProviders(userId: string): Promise<ModelProviderRow[]> {
  return db.select().from(modelProviders).where(eq(modelProviders.userId, userId))
    .orderBy(desc(modelProviders.isDefault), desc(modelProviders.updatedAt));
}

export async function getModelProvider(id: string, userId: string): Promise<ModelProviderRow | null> {
  const rows = await db.select().from(modelProviders).where(
    and(eq(modelProviders.id, id), eq(modelProviders.userId, userId)),
  ).limit(1);
  return rows[0] ?? null;
}

export async function saveModelProvider(input: typeof modelProviders.$inferInsert): Promise<ModelProviderRow> {
  if (input.isDefault) {
    await db.update(modelProviders).set({ isDefault: false }).where(eq(modelProviders.userId, input.userId));
  }
  const [row] = await db.insert(modelProviders).values(input).returning();
  return row;
}

export async function updateModelProvider(
  id: string,
  userId: string,
  updates: Partial<typeof modelProviders.$inferInsert>,
): Promise<ModelProviderRow | null> {
  if (updates.isDefault) {
    await db.update(modelProviders).set({ isDefault: false }).where(eq(modelProviders.userId, userId));
  }
  const [row] = await db.update(modelProviders).set({ ...updates, updatedAt: new Date() }).where(
    and(eq(modelProviders.id, id), eq(modelProviders.userId, userId)),
  ).returning();
  return row ?? null;
}

export async function deleteModelProvider(id: string, userId: string): Promise<boolean> {
  const selected = await db.select({ id: customWorks.id }).from(customWorks).where(
    and(eq(customWorks.ownerId, userId), eq(customWorks.selectedProviderId, id), ne(customWorks.status, "archived")),
  ).limit(1);
  if (selected[0]) return false;
  const rows = await db.delete(modelProviders).where(
    and(eq(modelProviders.id, id), eq(modelProviders.userId, userId)),
  ).returning({ id: modelProviders.id });
  return rows.length > 0;
}
