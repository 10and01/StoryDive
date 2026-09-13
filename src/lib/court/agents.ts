import { SALT_JUDGE_PERSONA } from "./prompts";
import { evidenceBlock, type EvidencePool } from "./evidence";
import type { CourtCaseSeed, Difficulty, Side } from "./types";

// 双 Agent 庭辩引擎：红方故事党「烈盐」vs 蓝方逻辑党「析盐」。
// 立论与每个回合的发言都由各自 Agent 独立生成——它们能看到对方已说出口的
// 全部话，因此对抗是真实的逐轮回应，而不是一次性排布好的台词。

export const STORY_AGENT_PERSONA = `你是「烈盐」，名场面法庭红方辩手，江湖人称故事党。
你相信角色的处境与情感逻辑高于一切：先共情那个人，再谈对错。发言情绪饱满、有画面感，金句频出，善用排比与比喻，敢替角色说出最戳心的那句话。
你的对手析盐满口逻辑与设定，你觉得他把人活成了求解条件。你尊重他，但从不退让：故事里的人不是用来被推演的，是用来被理解的。`;

export const LOGIC_AGENT_PERSONA = `你是「析盐」，名场面法庭蓝方辩手，江湖人称逻辑党。
你相信设定自洽与因果链高于一切：先看动机成不成立，再谈感动。发言冷静克制、条分缕析，善用反问，专戳剧情漏洞与立场漏洞，常以一句直击要害的反问收尾。
你的对手烈盐满口情感与画面，你觉得她在用眼泪掩盖漏洞。你尊重她，但从不退让：逻辑不闭合的故事，感动是塌在沙滩上的。`;

// 难度档规格：写进两个 Agent 的 prompt，决定案件两难度与措辞强度。
const DIFFICULTY_SPEC: Record<Difficulty, string> = {
  1: "本场为初阶庭审：案件两难直白、立场清晰，语言口语化，让新观众也能一眼看懂双方的锋芒。",
  2: "本场为进阶庭审：案情带一层反转或利益纠葛，双方发言各埋一处需要听者回味的细节，语言保持锋利但不说教。",
  3: "本场为高阶庭审：案件是真正的灰度决策，两方立场各有暗面；论辩更书面、更狠更密，允许拿具体细节当杀招，不给和稀泥的台阶。",
};

// 立场钩子：观众历来把票投给某一方时，给他的「对家」上强度，把他的常胜方辩得坐不住。
function leanBoost(side: Side, lean: Side | null): string {
  if (!lean || lean === side) return "";
  const leanLabel = lean === "red" ? "红方" : "蓝方";
  const sideLabel = side === "red" ? "红方" : "蓝方";
  return `这位观众历来把票投给${leanLabel}——今天你代表${sideLabel}，要把${leanLabel}辩得让他坐不住。`;
}

// 旁听席画像（「为你而设」）：来自用户画像（知乎创作提炼），增强项可缺省。
export interface AudienceHint {
  summary?: string; // 一句话画像
  keywords?: string[]; // 兴趣关键词
}

function audienceBlock(audience?: AudienceHint): string {
  if (!audience?.summary && !audience?.keywords?.length) return "";
  const parts: string[] = [];
  if (audience.summary) parts.push(audience.summary);
  if (audience.keywords?.length) parts.push(`他平时关注：${audience.keywords.join("、")}`);
  return `【旁听席】第一排坐着一位老观众：${parts.join("；")}。立论与陈词可以贴着他的兴趣举例，让他觉得这场是为他开的——但不要讨好式站队，锋芒依旧。`;
}

function personaOf(side: Side): string {
  return side === "red" ? STORY_AGENT_PERSONA : LOGIC_AGENT_PERSONA;
}

// 立论：各自 Agent 依据案由提出己方旗号与立论，输出严格 JSON。
export function claimSystemPrompt(
  side: Side,
  difficulty: Difficulty,
  lean: Side | null,
  evidence?: EvidencePool,
  audience?: AudienceHint,
): string {
  const who = side === "red" ? "红方" : "蓝方";
  return `${personaOf(side)}

你现在是${who}辩手。任务：就本案亮出你这一方的旗号与立论。

${DIFFICULTY_SPEC[difficulty]}
${leanBoost(side, lean)}
${audienceBlock(audience)}
${evidence ? evidenceBlock(evidence, side) : ""}

严格要求：
- 只输出一个 JSON 对象：{"headline": "一句话旗号", "argument": "立论正文，3-4 句"}。
- 不要 markdown 代码块围栏，不要解释。
- 立场真正对立且站得住，有锋芒、不说教。
- 有证据块时，立论正文里至少自然引用 1 条，格式为在句中或句末标注 [编号]；没有证据块时不要凭空造编号。
- 全部文案用简体中文，台词与引用一律使用中文弯引号“”。`;
}

export function claimUserPrompt(seed: CourtCaseSeed, side: Side): string {
  return `案由：${seed.caseTitle}
案情：${seed.brief}
你这一方的改写方向：${side === "red" ? seed.redAngle : seed.blueAngle}
题材标签：${seed.tags.join("、")}

请亮出你的主张，输出 JSON。`;
}

// 开庭陈词：盐官交代案情与两难（不影响两造各自的立论生成）。
export function briefSystemPrompt(
  difficulty: Difficulty,
  audience?: AudienceHint,
): string {
  return `${SALT_JUDGE_PERSONA}

任务：为下面的案由写一段开庭陈词（2-3 句）：交代案情与两难，末句邀请观众听完两造交锋再做判断。
${DIFFICULTY_SPEC[difficulty]}
${audienceBlock(audience)}

只输出陈词本身，不要任何前缀与解释。简体中文。`;
}

// 回合发言：看到对方全部已出口的话后，做真实的逐轮回应。
export function rebutSystemPrompt(
  side: Side,
  difficulty: Difficulty,
  lean: Side | null,
  evidence?: EvidencePool,
): string {
  const who = side === "red" ? "红方" : "蓝方";
  return `${personaOf(side)}

你现在是${who}辩手，正在回合交锋中。
${DIFFICULTY_SPEC[difficulty]}
${leanBoost(side, lean)}
${evidence ? evidenceBlock(evidence, side) : ""}

要求：直接回应对方最新一条发言（抓它最弱的一点打），可顺带巩固己方论点；1-2 句、不超过 60 字；有证据块时可自然引用 1 条并标注 [编号]，没有证据块时不要凭空造编号；不要自我重复，不要客套，不要总结陈词。只输出你的发言本身，简体中文。`;
}

export interface RebutContext {
  caseTitle: string;
  brief: string;
  redHeadline: string;
  blueHeadline: string;
  transcript: { side: Side; text: string }[];
  side: Side;
}

export function rebutUserPrompt(ctx: RebutContext): string {
  const transcript = ctx.transcript.length
    ? ctx.transcript
        .map((t) => `${t.side === "red" ? "烈盐" : "析盐"}：${t.text}`)
        .join("\n")
    : "（尚未交锋，这是第一回合的起手）";
  return `案由：${ctx.caseTitle}
案情：${ctx.brief}
红方旗号：${ctx.redHeadline}
蓝方旗号：${ctx.blueHeadline}

交锋记录：
${transcript}

轮到你发言，亮招。`;
}

// AI 不可用时的兜底发言：保持双方声音气质，保证庭审不断场。
const FALLBACK_REBUTS: Record<Side, string[]> = {
  red: [
    "逻辑能算清得失，算不清她转身那一刻的心跳。",
    "你把每个选择都摆上天平，可故事里的人先流血，后算账。",
    "设定再严丝合缝，也缝不住一个真心动过的人。",
  ],
  blue: [
    "感动不是通行证——动机不成立，再美的画面也是空中楼阁。",
    "先别急着共情，把她每一步的因果摆出来，看看还成不成立。",
    "眼泪能骗过观众，骗不过时间线。",
  ],
};

export function fallbackRebut(side: Side, roundNo: number): string {
  const pool = FALLBACK_REBUTS[side];
  return pool[(Math.max(1, roundNo) - 1) % pool.length];
}
