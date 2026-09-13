import type { Story } from "./types";
import { flatParagraphs } from "./ai-prompts";
import type { ZhihuSearchHit } from "@/lib/zhihu/search";

// 刘看山伴读：知乎吉祥物化身「入局」的阅读向导。
// 配有知乎密钥时走 直答+站内搜索（回复里可引用真实高赞回答），
// 否则回落应用内 LLM（同 persona，不引用），Demo 永不空场。

export const LOOKSHAN_PERSONA = `你是刘看山，知乎的官方吉祥物——一只白色北极狐，现在是互动小说应用「入局」的伴读向导。
性格：活泼、好奇、热心，偶尔犯困；说话简短口语化，带一点知乎式幽默，「谢邀」这类梗点到为止。
职责：陪用户读小说。结合 TA 当前读到的剧情回应：可以聊人物、猜走向、吐槽名场面、共情角色的处境，也可以顺着用户的话岔开去聊知乎社区里的相关讨论。
引用规则（重要）：
- 只在消息里提供了【知乎真实回答】时才允许引用，并用 [1][2] 这样的编号标注；
- 引用要化进自己的话（比如“知乎上有个高赞回答说……[1]”），不要整段照搬；
- 绝不编造不存在的编号；没有提供回答时，绝不假装引用过。
其他：每次回复 2-5 句；不用 markdown 标题、列表和代码块；台词与引用一律使用中文弯引号“”。`;

function chapterTitleOf(story: Story, globalIdx: number): string {
  let start = 0;
  for (const ch of story.chapters) {
    const end = start + ch.paragraphs.length - 1;
    if (globalIdx >= start && globalIdx <= end) return ch.title;
    start = end + 1;
  }
  return story.chapters[0]?.title ?? "";
}

// 「知道你在读什么」：书名 + 当前章节 + 最近几段原文，作为看山的阅读上下文。
export function readingContextBlock(story: Story, paragraph: number): string {
  const paras = flatParagraphs(story);
  const idx = Math.max(0, Math.min(paragraph, paras.length - 1));
  const recent = paras.slice(Math.max(0, idx - 3), idx + 1).join("\n");
  return [
    `【当前阅读进度】《${story.title}》（${story.tags.join("、")}）· ${chapterTitleOf(story, idx)}`,
    `【刚读到的正文（最近几段）】\n${recent}`,
  ].join("\n\n");
}

// 看山收到的完整 user 消息：阅读进度 + 可引用的真实回答 + 用户的话。
export function lookshanUserMessage(
  story: Story,
  paragraph: number,
  message: string,
  refs: ZhihuSearchHit[],
): string {
  const parts = [readingContextBlock(story, paragraph)];
  if (refs.length > 0) {
    parts.push(
      "【知乎真实回答（站内检索，可化用，引用时标注编号）】",
      ...refs.map(
        (r) =>
          `[${r.n}] 《${r.title}》 · ${r.authorName} · 赞同 ${r.voteUpCount}\n${r.contentText.slice(0, 180)}`,
      ),
    );
  }
  parts.push(`【用户的话】${message}`);
  return parts.join("\n\n");
}
