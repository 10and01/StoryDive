import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface SourceObject {
  body: ReadableStream | ArrayBuffer;
  size: number;
  contentType?: string;
}

function bucket(): R2Bucket {
  const store = getCloudflareContext().env.WORK_UPLOADS;
  if (!store) throw new Error("WORK_UPLOADS R2 binding is not configured");
  return store;
}

export async function putSourceObject(
  key: string,
  file: File,
  metadata: Record<string, string>,
): Promise<void> {
  await bucket().put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: metadata,
  });
}

export async function getSourceObject(key: string): Promise<SourceObject> {
  const object = await bucket().get(key);
  if (!object) throw new Error("Source file not found");
  return {
    body: object.body,
    size: object.size,
    contentType: object.httpMetadata?.contentType,
  };
}

export async function copySourceObject(fromKey: string, toKey: string): Promise<void> {
  const source = await bucket().get(fromKey);
  if (!source) throw new Error("Source file not found");
  await bucket().put(toKey, source.body, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata,
  });
}

export async function deleteSourceObject(key: string): Promise<void> {
  await bucket().delete(key);
}

export function sourceObjectKey(ownerId: string, format: string): string {
  const ownerHash = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `novels/${ownerHash}/${crypto.randomUUID()}/source.${format === "markdown" ? "md" : format}`;
}
