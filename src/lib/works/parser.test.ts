import assert from "node:assert/strict";
import test from "node:test";
import { parseNovelSource } from "./parser";
import { WorkInputError } from "./validation";

const encoder = new TextEncoder();

test("TXT chapters normalize into a stable chapter structure", async () => {
  const source = "第一章 初见\n\n风从窗外吹进来。\n\n她抬头看见旧友。\n\n第二章 决定\n\n他们必须在天亮前做出选择。";
  const bytes = encoder.encode(source);
  const novel = await parseNovelSource(bytes.buffer, "txt", "选择.txt");
  assert.equal(novel.title, "选择");
  assert.equal(novel.chapters.length, 2);
  assert.equal(novel.chapters[0].title, "第一章 初见");
  assert.deepEqual(novel.chapters[1].paragraphs, ["他们必须在天亮前做出选择。"]) ;
});

test("Markdown headings are treated as chapter boundaries", async () => {
  const bytes = encoder.encode("# 第一章 起点\n\n正文一。\n\n## 第二章 岔路\n\n正文二。");
  const novel = await parseNovelSource(bytes.buffer, "markdown", "demo.md");
  assert.equal(novel.chapters.length, 2);
  assert.equal(novel.chapters[1].title, "第二章 岔路");
});

test("oversized normalized text returns an actionable error", async () => {
  const bytes = encoder.encode("字".repeat(2_000_001));
  await assert.rejects(
    () => parseNovelSource(bytes.buffer, "txt", "too-large.txt"),
    (error: unknown) => error instanceof WorkInputError && error.code === "text_too_large",
  );
});

test("invalid EPUB produces a clear structure error", async () => {
  const bytes = encoder.encode("not-a-zip");
  await assert.rejects(
    () => parseNovelSource(bytes.buffer, "epub", "broken.epub"),
    (error: unknown) => error instanceof WorkInputError && error.code === "invalid_epub",
  );
});
