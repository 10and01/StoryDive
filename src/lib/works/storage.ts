import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface SourceObject {
  body: ReadableStream | ArrayBuffer;
  size: number;
  contentType?: string;
}

interface SourceMetadata {
  size: number;
  contentType: string;
  custom: Record<string, string>;
}

export class SourceObjectNotFoundError extends Error {
  constructor() {
    super("Source file not found");
    this.name = "SourceObjectNotFoundError";
  }
}

function store(): KVNamespace {
  const store = getCloudflareContext().env.WORK_UPLOADS;
  if (!store) throw new Error("WORK_UPLOADS KV binding is not configured");
  return store;
}

export async function putSourceObject(
  key: string,
  file: File,
  metadata: Record<string, string>,
): Promise<void> {
  await store().put(key, file.stream(), {
    metadata: {
      size: file.size,
      contentType: file.type || "application/octet-stream",
      custom: metadata,
    } satisfies SourceMetadata,
  });
}

export async function getSourceObject(key: string): Promise<SourceObject> {
  const object = await store().getWithMetadata<SourceMetadata>(key, "stream");
  if (!object.value) throw new SourceObjectNotFoundError();
  return {
    body: object.value,
    size: object.metadata?.size ?? 0,
    contentType: object.metadata?.contentType,
  };
}

export async function copySourceObject(fromKey: string, toKey: string): Promise<void> {
  const source = await store().getWithMetadata<SourceMetadata>(fromKey, "arrayBuffer");
  if (!source.value) throw new SourceObjectNotFoundError();
  await store().put(toKey, source.value, {
    metadata: source.metadata,
  });
}

export async function deleteSourceObject(key: string): Promise<void> {
  await store().delete(key);
}

export function sourceObjectKey(ownerId: string, format: string): string {
  const ownerHash = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `novels/${ownerHash}/${crypto.randomUUID()}/source.${format === "markdown" ? "md" : format}`;
}
