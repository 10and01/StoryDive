import type { WorkVisibility } from "./types";

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_NORMALIZED_CHARACTERS = 2_000_000;
export const MAX_CHAPTERS = 500;
export const MAX_EPUB_ENTRIES = 2_000;
export const MAX_EPUB_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;

const SAFE_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream",
  "application/epub+zip",
]);

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "markdown", "epub"]);
const DANGEROUS_METADATA = [
  /ignore\s+(all|any|previous)\s+(instructions?|prompts?)/i,
  /system\s*prompt/i,
  /developer\s*message/i,
  /忽略.{0,8}(指令|提示词|系统)/,
  /覆盖.{0,8}(指令|提示词|系统)/,
];

export class WorkInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "WorkInputError";
  }
}

export function sourceFormatFromFile(file: File): "txt" | "markdown" | "epub" {
  const name = file.name.normalize("NFKC").replace(/[\\/\0]/g, "_");
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new WorkInputError("unsupported_format", "仅支持 TXT、Markdown 和 EPUB 文件。");
  }
  if (file.size <= 0) throw new WorkInputError("empty_file", "文件内容为空，请选择另一份小说。");
  if (file.size > MAX_SOURCE_BYTES) {
    throw new WorkInputError("file_too_large", "文件超过 20 MiB，请拆分或压缩正文后重试。");
  }
  if (file.type && !SAFE_TEXT_TYPES.has(file.type.toLowerCase())) {
    throw new WorkInputError("invalid_mime", "文件类型与扩展名不一致，请重新导出后上传。");
  }
  return extension === "epub" ? "epub" : extension === "txt" ? "txt" : "markdown";
}

export function safeFileName(name: string): string {
  return name.normalize("NFKC").replace(/[\\/\0\r\n]/g, "_").slice(0, 180) || "novel.txt";
}

export function normalizeTags(value: unknown): string[] {
  const input = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，]/) : [];
  return [...new Set(input.map((tag) => String(tag).normalize("NFKC").trim()).filter(Boolean))].slice(0, 8);
}

export function normalizeMetadataText(value: unknown, max: number): string {
  return typeof value === "string" ? value.normalize("NFKC").replace(/\0/g, "").trim().slice(0, max) : "";
}

export function validatePublicMetadata(input: { title: string; description: string; tags: string[] }): void {
  const combined = [input.title, input.description, ...input.tags].join("\n");
  if (DANGEROUS_METADATA.some((pattern) => pattern.test(combined))) {
    throw new WorkInputError(
      "unsafe_metadata",
      "标题、简介或标签中包含疑似提示注入内容，请移除后再发布。",
      422,
    );
  }
}

export function isVisibility(value: unknown): value is WorkVisibility {
  return value === "private" || value === "unlisted" || value === "public";
}

export function randomShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
