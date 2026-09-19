import {
  MAX_CHAPTERS,
  MAX_EPUB_ENTRIES,
  MAX_EPUB_UNCOMPRESSED_BYTES,
  MAX_NORMALIZED_CHARACTERS,
  WorkInputError,
} from "./validation";
import type { ParsedNovel, ParsedNovelChapter } from "./types";

const CHAPTER_HEADING = /^(?:#{1,3}\s*)?(?:(?:第[零〇一二两三四五六七八九十百千万\d]+[章节卷部回])|(?:chapter\s+\d+)|(?:序章|楔子|引子|前言|后记|尾声|番外))(?:[\s:：·—-].*)?$/i;

function decodeBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const replacementRatio = (utf8.match(/�/g)?.length ?? 0) / Math.max(utf8.length, 1);
  if (replacementRatio < 0.015) return utf8;
  try {
    return new TextDecoder("gb18030", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

function stripMarkup(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeSource(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!normalized) throw new WorkInputError("empty_text", "没有从文件中读到正文，请检查文件编码或内容。");
  if (normalized.length > MAX_NORMALIZED_CHARACTERS) {
    throw new WorkInputError(
      "text_too_large",
      "解析后正文超过 2,000,000 字符，请拆成多部作品后分别上传。",
    );
  }
  return normalized;
}

function paragraphize(value: string): string[] {
  const blocks = value
    .replace(/^#{1,6}\s+/gm, "")
    .split(/\n\s*\n|\n(?=[“\"「『（(])/)
    .map((part) => part.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  const text = blocks[0] ?? value;
  const chunks = text.match(/[\s\S]{1,900}(?:[。！？!?]|$)/g)?.map((part) => part.trim()).filter(Boolean);
  return chunks?.length ? chunks : [text];
}

function splitPlainText(text: string, fallbackTitle: string): ParsedNovel {
  const lines = normalizeSource(text).split("\n");
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current = { title: fallbackTitle, lines: [] as string[] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length <= 80 && CHAPTER_HEADING.test(trimmed)) {
      if (current.lines.some((item) => item.trim())) sections.push(current);
      current = { title: trimmed.replace(/^#{1,3}\s*/, ""), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((item) => item.trim()) || sections.length === 0) sections.push(current);
  if (sections.length > MAX_CHAPTERS) {
    throw new WorkInputError("too_many_chapters", "章节超过 500 章，请按卷拆分后重新上传。");
  }
  const chapters = sections
    .map((section, index): ParsedNovelChapter => ({
      title: section.title === fallbackTitle && sections.length > 1 ? `第 ${index + 1} 章` : section.title,
      paragraphs: paragraphize(section.lines.join("\n")),
    }))
    .filter((chapter) => chapter.paragraphs.some(Boolean));
  const characterCount = chapters.reduce(
    (total, chapter) => total + chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0),
    0,
  );
  return { title: fallbackTitle, characterCount, chapters };
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (u16(bytes, offset) | (u16(bytes, offset + 2) << 16)) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (!("DecompressionStream" in globalThis)) {
    throw new WorkInputError("epub_unavailable", "当前运行环境无法解压 EPUB，请改用 TXT 或 Markdown。");
  }
  const stable = new Uint8Array(new ArrayBuffer(data.byteLength));
  stable.set(data);
  const stream = new Blob([stable]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  for (let offset = 0; offset + 46 <= bytes.length; ) {
    const signature = u32(bytes, offset);
    if (signature !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const compressedSize = u32(bytes, offset + 20);
    const uncompressedSize = u32(bytes, offset + 24);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (!name || name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      throw new WorkInputError("invalid_epub_path", "EPUB 包含不安全的文件路径，请重新导出。");
    }
    entries.push({
      name,
      method: u16(bytes, offset + 10),
      compressedSize,
      uncompressedSize,
      localOffset: u32(bytes, offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
    if (entries.length > MAX_EPUB_ENTRIES) {
      throw new WorkInputError("epub_too_many_files", "EPUB 内文件超过 2,000 个，请简化后重新导出。");
    }
  }
  const expanded = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  if (expanded > MAX_EPUB_UNCOMPRESSED_BYTES) {
    throw new WorkInputError("epub_too_large", "EPUB 解压后超过 40 MiB，可能包含过多图片或异常内容。");
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const offset = entry.localOffset;
  if (u32(bytes, offset) !== 0x04034b50) throw new WorkInputError("invalid_epub", "EPUB 压缩结构损坏。");
  const nameLength = u16(bytes, offset + 26);
  const extraLength = u16(bytes, offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRaw(compressed);
  throw new WorkInputError("unsupported_epub_compression", "EPUB 使用了不支持的压缩方式，请重新导出。");
}

function xmlTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripMarkup(match[1]).trim() : undefined;
}

function resolveZipPath(base: string, relative: string): string {
  const stack = base.split("/").filter(Boolean);
  for (const part of relative.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

async function parseEpub(bytes: Uint8Array, fallbackTitle: string): Promise<ParsedNovel> {
  const entries = listZipEntries(bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const container = byName.get("META-INF/container.xml");
  if (!container) throw new WorkInputError("invalid_epub", "EPUB 缺少 container.xml，无法定位正文。");
  const containerXml = decodeBytes(await readZipEntry(bytes, container));
  const rootfile = containerXml.match(/full-path=["']([^"']+)["']/i)?.[1];
  if (!rootfile || !byName.has(rootfile)) throw new WorkInputError("invalid_epub", "EPUB 未声明有效的内容目录。");
  const packageXml = decodeBytes(await readZipEntry(bytes, byName.get(rootfile)!));
  const title = xmlTag(packageXml, "dc:title") || fallbackTitle;
  const manifest = new Map<string, string>();
  for (const match of packageXml.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    manifest.set(match[1], match[2]);
  }
  const spineIds = [...packageXml.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
  const packageDir = rootfile.includes("/") ? rootfile.slice(0, rootfile.lastIndexOf("/") + 1) : "";
  const chapters: ParsedNovelChapter[] = [];
  for (const id of spineIds) {
    const href = manifest.get(id);
    if (!href) continue;
    const path = resolveZipPath(packageDir, decodeURIComponent(href.split("#")[0]));
    const entry = byName.get(path);
    if (!entry) continue;
    const html = decodeBytes(await readZipEntry(bytes, entry));
    const heading = xmlTag(html, "h1") || xmlTag(html, "h2") || `第 ${chapters.length + 1} 章`;
    const plain = stripMarkup(html);
    const paragraphs = paragraphize(plain.replace(heading, "").trim());
    if (paragraphs.join("").trim()) chapters.push({ title: heading.slice(0, 100), paragraphs });
    if (chapters.length > MAX_CHAPTERS) {
      throw new WorkInputError("too_many_chapters", "EPUB 章节超过 500 章，请按卷拆分后重试。");
    }
  }
  const normalized = normalizeSource(chapters.flatMap((chapter) => chapter.paragraphs).join("\n\n"));
  return { title, characterCount: normalized.length, chapters };
}

export async function parseNovelSource(
  data: ArrayBuffer,
  format: "txt" | "markdown" | "epub",
  fileName: string,
): Promise<ParsedNovel> {
  const fallbackTitle = fileName.replace(/\.(txt|md|markdown|epub)$/i, "").trim() || "未命名故事";
  const bytes = new Uint8Array(data);
  return format === "epub" ? parseEpub(bytes, fallbackTitle) : splitPlainText(decodeBytes(bytes), fallbackTitle);
}
