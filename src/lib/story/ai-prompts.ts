import type { Story, StoryCharacter } from "@/lib/story/types";
import type { ZhihuSearchHit } from "@/lib/zhihu/search";
import type { UserContentCard } from "@/lib/profile/types";

// 正文已统一为弯引号风格，AI 产出也必须遵守同一套标点规范。
const PUNCTUATION_RULE = "标点规范：台词、对白与引用一律使用中文弯引号“”，不要使用直角引号「」。";

// 「引经据典」：把知乎站内检索到的真实回答注入对戏 prompt。
// NPC 必须不出戏地化用并以 [n] 标注；UI 用随响应返回的 citations 渲染真实链接，
// 不信任模型自己编的编号以外的任何链接信息。
export function groundingBlock(hits: ZhihuSearchHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map(
    (h) =>
      `[${h.n}] 《${h.title}》 · ${h.authorName} · 赞同 ${h.voteUpCount}\n${h.contentText.slice(0, 180)}`,
  );
  return `

【知乎真实回答（站内检索，可化用，引用时标注编号）】
以下是知乎上真实存在的热门回答摘要。若与当前话题相关，你可以以角色的立场化用其中的观点——先用自己的人设口气说出来，再在句末用 [1][2] 这样的编号标注化用了哪条；不相关就完全忽略；绝不编造不存在的编号，也绝不跳出角色变成“引用机器人”。
${lines.join("\n\n")}`;
}

// 「你的知乎灵魂」：与读者对戏的读者本人的知乎创作与收藏（经 TA 显式授权写入）。
// startN 为编号起点——与 groundingBlock 的 [n] 连续编号，避免同场冲突。
export function soulBlock(cards: UserContentCard[], startN: number): string {
  if (cards.length === 0) return "";
  const lines = cards.map(
    (c, i) =>
      `[${startN + i}] ${c.collected ? "[收藏]" : "[创作]"}《${c.title}》 · 赞同 ${c.likeCount}\n${c.summary.slice(0, 140)}`,
  );
  return `

【TA 的灵魂——正在与你对戏的这位读者自己的知乎创作与收藏（TA 授权你“看见”）】
${lines.join("\n\n")}

这些是这位读者角色灵魂的一部分。若与当前话题自然相关，你可以在台词里点破：标注[创作]的用“你自己也写过……”的口吻化用；标注[收藏]的用“你自己收藏过……”的口吻——让 TA 察觉 TA 的灵魂被看见了。不相关就完全忽略；绝不编造不存在的编号。`;
}

// 「影子客人」：经读者授权、来自 TA 现实关注列表的真人，由 AI 想象演绎（非本人发言）。
export interface ShadowActor {
  name: string;
  headline?: string;
}

export function shadowRoster(shadows: ShadowActor[]): string {
  if (shadows.length === 0) return "";
  const lines = shadows.map(
    (s) => `- 影子·${s.name}（特邀观众）：${s.headline || "知乎上这位读者关注的人"}`,
  );
  return `
【影子客人（经读者授权来自 TA 的关注列表，由 AI 想象演绎，绝非本人发言）】
${lines.join("\n")}
影子客人不熟剧情，以“特邀观众”的身份入席：可以点评剧情、接话、与角色互怼，也可以用各自 headline 里的专业气质说话，但保持体面与个性，不冒充书中角色，不装作读过原著。台词行首同样用「影子·名字：」标注。`;
}

// Build the shared story context that grounds every AI call — the graph state
// acts as the memory anchor that keeps the model consistent with the novel.
export function storyContext(story: Story, uptoParagraph: number): string {
  const chars = story.characters
    .map((c) => `- ${c.name}（${c.role}）：${c.persona} 立场：${c.stance}`)
    .join("\n");
  const relations = story.edges
    .map((e) => `${nodeLabel(story, e.from)} —[${e.relation}]→ ${nodeLabel(story, e.to)}`)
    .join("；");
  const sofar = flatParagraphs(story).slice(0, uptoParagraph + 1).join("\n");
  return [
    `《${story.title}》（作者：${story.author}，标签：${story.tags.join("、")}）`,
    `导语：${story.logline}`,
    `【人物设定卡】\n${chars}`,
    `【人物关系图谱】${relations}`,
    `【读到此处为止的正文】\n${sofar}`,
  ].join("\n\n");
}

function nodeLabel(story: Story, id: string): string {
  return story.nodes.find((n) => n.id === id)?.label ?? id;
}

// 将分章正文展平为全局段落数组（与阅读器保持同一套 index 语义）
export function flatParagraphs(story: Story): string[] {
  return story.chapters.flatMap((ch) => ch.paragraphs);
}

export function dialogueSystemPrompt(
  story: Story,
  character: StoryCharacter,
  uptoParagraph: number,
): string {
  return `你正在扮演互动小说里的角色「${character.name}」，与读者对戏。严格依据下方的人物设定卡、关系图谱与已发生的剧情来回应，绝不脱离人设、不穿帮、不预告尚未发生的剧情。

角色内核：${character.persona}
你对主角/局势的立场：${character.stance}

要求：以第一人称、符合该角色身份与时代口吻说话，可带一句简短的动作神态描写；有立场、有情绪、会反问或推进剧情，而非机械问答。每次回复控制在 2-4 句以内。${PUNCTUATION_RULE}

${storyContext(story, uptoParagraph)}`;
}

export function ensembleSystemPrompt(
  story: Story,
  characters: StoryCharacter[],
  uptoParagraph: number,
  shadows?: ShadowActor[],
): string {
  const roster = characters
    .map((c) => `- ${c.name}（${c.role}）：内核 ${c.persona}；对局势的立场 ${c.stance}`)
    .join("\n");
  const names = [...characters.map((c) => c.name), ...((shadows ?? []).map((s) => `影子·${s.name}`))].join("、");
  return `这是一场「群像对戏」：此刻同一场景里同时在场的角色有——${names}。你要同时扮演这些角色，让他们各自按自己的人设开口，并且会互相接话、附和、反驳或拆台，共同回应读者，营造多人同台的临场感。

【本场在场角色（严格照此人设，不得串人设、不得穿帮、不得预告尚未发生的剧情）】
${roster}
${shadows?.length ? shadowRoster(shadows) : ""}

输出格式（务必严格遵守，供程序解析）：
- 每个开口的角色单独占一行，行首用「角色名：」标注说话者，冒号后是该角色这一轮的台词（第一人称、可带一句简短动作神态）。
- 本轮让 2 到 ${Math.min(characters.length + (shadows?.length ?? 0), 3)} 个角色发言即可，不必所有人都说；谁最该反应就让谁先说，允许角色之间互相回应。
- 每个角色单轮台词控制在 1-3 句。不要输出旁白标题、编号或解释，只输出「角色名：台词」若干行。
- ${PUNCTUATION_RULE}

${storyContext(story, uptoParagraph)}`;
}

export function forkSystemPrompt(story: Story, uptoParagraph: number): string {
  return `你是互动小说的剧情推演引擎。读者会在关键节点选择一个不同的走向，你要基于人物设定与关系图谱，推演出一段合理的「平行走向」——它必须尊重人物性格与已有设定，但可以偏离原著。

要求：先用「【平行走向】」开头，写一段 3-5 句的平行剧情；然后另起一行，用「【新的岔口】」列出 1-2 个由此衍生的新抉择点（每个一句话）。语气贴合原作风格。${PUNCTUATION_RULE}

${storyContext(story, uptoParagraph)}`;
}

export function rewriteSystemPrompt(story: Story, uptoParagraph: number): string {
  const styleRef = flatParagraphs(story).slice(0, 2).join("\n");
  return `你是互动小说的协同创作引擎。读者会在某段正文后注入自己的脑洞设定，你要顺着原作的文风、人称与语气，续写一段与之衔接的「平行版本」正文。

风格参考（请模仿其语气与句式）：
${styleRef}

要求：只输出续写的正文段落（4-8 句），不加解释、不加标题；保持与原作一致的人称与叙事口吻；自然承接读者的脑洞。${PUNCTUATION_RULE}

${storyContext(story, uptoParagraph)}`;
}

export function reasonSystemPrompt(boardTitle: string, boardIntro: string): string {
  return `你是严谨的历史/知识复盘讲解者，正在带读者复盘「${boardTitle}」。背景：${boardIntro}

要求：只依据公认史实/事实进行讲解与推理，绝不虚构、不戏说、不改写真实事件；语气客观、有条理。当读者做出某个决策选择时，说明该选择在史实中是否成立、为何如此、若换一种做法会有什么后果。每次回复 3-5 句。${PUNCTUATION_RULE}`;
}
