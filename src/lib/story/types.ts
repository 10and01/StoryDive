// 「入局」核心领域类型：小说、角色、图谱、入局点、分支
import type { AmbientMoodName } from "./ambient";

export type StoryTrack = "fiction" | "nonfiction";

export interface StoryCharacter {
  id: string;
  name: string;
  role: string; // 一句话身份
  persona: string; // 扮演时的立场/语气/秘密（喂给 AI 的人设卡）
  stance: string; // 在图谱上对主角的关系
  portrait?: string; // 角色形象图 URL
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "character" | "event" | "choice";
  // 归一化坐标 0-100，用于 svg 星链布局
  x: number;
  y: number;
  // 该节点关联的章节序号（用于「情节时间线」视图按章排布；人物节点可留空）
  chapter?: number;
  // 事件 / 抉择节点的说明（点击节点时在详情面板展示；人物节点用 persona 代替）
  brief?: string;
  // 事件 / 抉择节点的场景配图（点击节点时作为详情面板顶部背景图，与人物立绘同等待遇）
  image?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string; // 君臣 / 敌对 / 暗算 / 因果 …
}

// 正文中的一个可交互「入局点」
export interface EnterPoint {
  paragraphIndex: number; // 挂在哪一段末尾
  hint: string; // 悬浮提示
  presentCharacterIds: string[]; // 此处在场、可对戏的角色
  branchPrompt?: string; // 分叉时给用户看的关键抉择问题
  branchOptions?: string[]; // 预设分叉选项
}

// 一章：忠实原作章节骨架，正文为原创复述，配一张场景背景图
export interface StoryChapter {
  index: number; // 原作章节序号（对应 01/02 或 1/2）
  title: string; // 章节标题
  sceneImage?: string; // 该章场景背景图 URL
  // 该章正文分段（原创复述，非原文转录）
  paragraphs: string[];
}

export interface Story {
  id: string;
  title: string;
  author: string;
  // —— 版权归属（知乎盐言故事要求：展示/摘要/改编时保留作者、作品名、work_id、来源）——
  workId: string; // 原作作品ID（work_id），不可删除
  source: string; // 来源说明，如「知乎盐言故事」
  attribution?: string; // 归属/改编声明：本文为剧情导读，版权归原作者
  track: StoryTrack;
  tags: string[];
  logline: string; // 导语
  objectAlt: string; // 旧物插画 alt
  objectImage: string; // 书架物件插画
  coverImage?: string; // 沉浸式封面竖图（阅读器入场幕使用，缺省回退到首章场景图/物件插画）
  ambientMood?: AmbientMoodName; // 环境氛围音基调（Web Audio 合成，可开关）
  chapters: StoryChapter[]; // 分章正文（每章配图）
  characters: StoryCharacter[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  enterPoints: EnterPoint[];
}

// 纪实线：知识推理盘的一个决策节点
export interface ReasonNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "force" | "terrain" | "decision" | "clue";
  brief: string; // 点开时 AI 依史实复盘的要点
}

export interface ReasonBoard {
  storyId: string;
  title: string;
  subtitle: string;
  intro: string;
  characters?: StoryCharacter[];
  chapters?: StoryChapter[]; // 可选：纪实篇也做成分章可读正文（客观复述史实/公开报道，配图）
  nodes: ReasonNode[];
  edges: { from: string; to: string; relation: string }[];
  // 关键决策点：用户在此选择，AI 依史实讲解
  decisions: {
    id: string;
    question: string;
    options: { label: string; verdict: string }[];
  }[];
}

// 用户在图谱上长出的一条支线（对戏 / 分叉 / 改写的产物）
export type BranchKind = "dialogue" | "fork" | "rewrite";

export interface StoryBranch {
  id: string;
  storyId: string;
  storyTitle: string;
  kind: BranchKind;
  anchorParagraph: number;
  parentId: string | null; // 父支线 id；null 表示根支线（直接从原著入局点长出）
  title: string; // 结局卡片标题 / 支线名
  body: string; // 对话记录 / 平行走向 / 改写正文
  createdAt: string;
}
