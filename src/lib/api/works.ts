import type { Story } from "@/lib/story/types";
import { request } from "./request";

export interface WorkSummary {
  id: string;
  ownerId: string;
  ownerName: string | null;
  title: string;
  description: string;
  tags: string[];
  coverImage: string | null;
  sourceFormat: string;
  sourceFileName?: string;
  visibility: "private" | "unlisted" | "public";
  status: "draft" | "processing" | "ready" | "failed" | "archived";
  safetyStatus: string;
  rightsConfirmed: boolean;
  selectedProviderId?: string | null;
  publishedVersionId: string | null;
  sourceWorkId: string | null;
  sourceWorkTitle: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shareUrl?: string | null;
}

export interface GenerationJob {
  id: string;
  workId: string;
  versionId: string | null;
  status: string;
  stage: string;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  providerName: string;
  attemptCount: number;
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  maskedApiKey: string;
  model: string;
  isDefault: boolean;
  status: string;
  lastTestedAt: string | null;
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

export async function fetchMyWorks(): Promise<WorkSummary[]> {
  const data = await jsonOrError<{ works: WorkSummary[] }>(await request("/api/works"));
  return data.works;
}

export async function fetchPublicWorks(query = ""): Promise<WorkSummary[]> {
  const data = await jsonOrError<{ works: WorkSummary[] }>(
    await request(`/api/public/works${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  );
  return data.works;
}

export async function createWork(form: FormData): Promise<{ work: WorkSummary; job: GenerationJob }> {
  return jsonOrError(await request("/api/works", { method: "POST", body: form }));
}

export async function fetchWork(id: string, token?: string | null): Promise<{
  work: WorkSummary;
  preview: Story | null;
  job: GenerationJob | null;
}> {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  return jsonOrError(await request(`/api/works/${encodeURIComponent(id)}${suffix}`));
}

export async function fetchPlayableWork(id: string, token?: string | null): Promise<{
  work: WorkSummary;
  versionId: string;
  story: Story;
}> {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  return jsonOrError(await request(`/api/works/${encodeURIComponent(id)}/play${suffix}`));
}

export async function fetchGenerationJob(id: string): Promise<GenerationJob> {
  const data = await jsonOrError<{ job: GenerationJob }>(
    await request(`/api/generation-jobs/${encodeURIComponent(id)}`),
  );
  return data.job;
}

export async function updateWork(id: string, body: Record<string, unknown>): Promise<WorkSummary> {
  const data = await jsonOrError<{ work: WorkSummary }>(
    await request(`/api/works/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.work;
}

export async function publishWork(
  id: string,
  visibility: WorkSummary["visibility"],
): Promise<WorkSummary> {
  const data = await jsonOrError<{ work: WorkSummary }>(
    await request(`/api/works/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility, rightsConfirmed: true }),
    }),
  );
  return data.work;
}

export async function unpublishWork(id: string): Promise<WorkSummary> {
  const data = await jsonOrError<{ work: WorkSummary }>(
    await request(`/api/works/${encodeURIComponent(id)}/unpublish`, { method: "POST" }),
  );
  return data.work;
}

export async function copyWork(id: string, token?: string | null): Promise<WorkSummary> {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  const data = await jsonOrError<{ work: WorkSummary }>(
    await request(`/api/works/${encodeURIComponent(id)}/copy${suffix}`, { method: "POST" }),
  );
  return data.work;
}

export async function retryGeneration(id: string, usePlatformDefault = false): Promise<GenerationJob> {
  const data = await jsonOrError<{ job: GenerationJob }>(
    await request(`/api/generation-jobs/${encodeURIComponent(id)}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usePlatformDefault }),
    }),
  );
  return data.job;
}

export async function fetchProviders(): Promise<ModelProvider[]> {
  const data = await jsonOrError<{ providers: ModelProvider[] }>(
    await request("/api/settings/model-providers"),
  );
  return data.providers;
}

export async function createProvider(body: Record<string, unknown>): Promise<ModelProvider> {
  const data = await jsonOrError<{ provider: ModelProvider }>(
    await request("/api/settings/model-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.provider;
}

export async function testProvider(id: string): Promise<ModelProvider> {
  const data = await jsonOrError<{ provider: ModelProvider }>(
    await request(`/api/settings/model-providers/${encodeURIComponent(id)}/test`, { method: "POST" }),
  );
  return data.provider;
}

export async function deleteProvider(id: string): Promise<void> {
  const response = await request(`/api/settings/model-providers/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await jsonOrError(response);
}
