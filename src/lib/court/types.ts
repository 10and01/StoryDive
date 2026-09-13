// 「双人对赌·名场面法庭」领域类型：同一个案由（名场面/话题）由盐灵现生成
// 红蓝两造对立改写，经 3 回合交锋后由观众投票定胜负，盐官 Agent 给一句总评。

export type Side = "red" | "blue";

// 一造主张：立场标题 + 一段立论正文
export interface CourtClaim {
  side: Side;
  headline: string; // 主张标题（旗号，一句话）
  argument: string; // 立论正文（这条改写为何成立）
  agentName?: string; // 庭辩 Agent 名号（烈盐 / 析盐）；兜底局也带
}

// 庭辩难度档（依观众历史投票自适应）：
// 1 初阶=直白两难；2 进阶=反转+利益纠葛；3 高阶=灰度决策、论辩书面化加重
export type Difficulty = 1 | 2 | 3;

// 庭辩 Agent：红方故事党「烈盐」vs 蓝方逻辑党「析盐」
export interface CourtAgent {
  side: Side;
  name: string;
  title: string; // 故事党 / 逻辑党
}

export const COURT_AGENTS: Record<Side, CourtAgent> = {
  red: { side: "red", name: "烈盐", title: "故事党" },
  blue: { side: "blue", name: "析盐", title: "逻辑党" },
};

// 一回合交锋：红蓝各一句针锋相对的驳火
export interface CourtRound {
  red: string; // 红方发言
  blue: string; // 蓝方发言
}

// 一局完整庭审
export interface CourtCase {
  id: string;
  caseTitle: string; // 案由标题（名场面/话题）
  brief: string; // 案情简述（盐灵开庭陈词）
  source: "story" | "topic" | "generated"; // 来自故事名场面 / 话题 / 现生成
  red: CourtClaim;
  blue: CourtClaim;
  rounds: CourtRound[]; // 交锋回合（建议 3）
  verdictHint: string; // 盐官引导投票的一句话
  createdAt: string; // ISO
}

// 一局双 Agent 对抗庭审（新流程）：立论由烈盐/析盐分别生成，
// 交锋回合逐轮实时生成（各自能看到对方已说出口的全部话），服务端不落库。
export interface CourtDuel {
  id: string; // caseId（案由种子 + 当天），投票汇聚用
  caseTitle: string;
  brief: string; // 盐官开庭陈词
  difficulty: Difficulty;
  red: CourtClaim;
  blue: CourtClaim;
  verdictHint: string;
  // ——论据战扩展（推荐案由/证据管线不可用时均可缺省）——
  questionUrl?: string; // 推荐案由来源的真实知乎问题（「深挖这个问题」入口）
  evidence?: EvidenceItem[]; // 全局编号证据池，前端渲染 [n] 引用 chip
  personalized?: boolean; // 是否已按该观众画像定制（「为你而设」标识）
}

// 论据战证据：一条真实知乎回答的摘要 + 链接，全局编号对应发言里的 [n] 标注。
// 摘要来自 question_answers 服务端摘要；赞同数是站内搜索交叉标注（匹配不上则缺省）。
export interface EvidenceItem {
  n: number; // 全局编号（从 1 起）
  url: string;
  summary: string;
  voteUpCount?: number;
  kind: "emotion" | "logic"; // 情感池 / 数据池（烈盐 / 析盐 各取一池）
}

// 观众历史画像：由 court_votes 聚合，驱动难度与立场钩子
export interface CourtProfile {
  totalVotes: number;
  red: number;
  blue: number;
  redShare: number; // 0-100
  lean: Side | null; // 明显偏向（≥3 票且占比 ≥60%）才算
  difficulty: Difficulty;
}

// 案由池：兜底时盐灵从这里取一个名场面/话题现开庭。
// 每条给出对立的两种改写方向，喂给 AI 生成红蓝两造。
export interface CourtCaseSeed {
  id: string;
  caseTitle: string;
  brief: string;
  redAngle: string; // 红方改写方向
  blueAngle: string; // 蓝方改写方向
  tags: string[];
}

export const COURT_CASE_POOL: CourtCaseSeed[] = [
  {
    id: "room-ending",
    caseTitle: "《不提分就出不去的房间》：走出房间那一刻，她该怎么选？",
    brief:
      "分数达标、锁死的门终于松动。面对回头示好的青梅竹马，和陪她死磕的冷面学霸，宋柠柠的结局该怎么写？",
    redAngle: "她谁都不选，先为自己而学——走出房间是独立宣言，爱情不是奖赏。",
    blueAngle: "她向李迟游挑明心意——并肩死磕的人，才配走进她的下一程。",
    tags: ["言情", "成长", "名场面"],
  },
  {
    id: "renlian-loop",
    caseTitle: "《人脸解锁失败》：循环里的她，该冲出去还是先自保？",
    brief:
      "凌晨三点的死亡循环，外婆命悬一线。第一次看清持刀女人时，小柚的正确解法是什么？",
    redAngle: "立刻冲出去拼命护住外婆——哪怕再死一轮，也不做门后的懦夫。",
    blueAngle: "先冷静观察摸清规律——莽撞只会白白搭上两条命，破局才是真的救人。",
    tags: ["悬疑", "循环", "名场面"],
  },
  {
    id: "boss-topic",
    caseTitle: "空降当领导第一天，该立威还是先立信？",
    brief:
      "老下属集体下马威。新主管的第一步，是先把场子镇住，还是先把人心焐热？",
    redAngle: "先立威——不镇住场子，往后每个决定都会被架空。",
    blueAngle: "先立信——人心焐热了，威自然就有了；硬立威只会众叛亲离。",
    tags: ["职场", "管理", "话题"],
  },
  {
    id: "reunion-topic",
    caseTitle: "同学聚会上，要不要拆穿那个善意的谎言？",
    brief:
      "风光的老同学在撑一个体面的谎，全场只有你知道真相。你开口，还是沉默？",
    redAngle: "拆穿——真相纵然难堪，纵容谎言只会让他陷得更深。",
    blueAngle: "沉默——那点体面是他此刻唯一的盔甲，戳破不是善良是残忍。",
    tags: ["情感", "人际", "话题"],
  },
  {
    id: "ai-topic",
    caseTitle: "工作明天就被 AI 取代，该硬扛还是转身？",
    brief:
      "公司群里宣布你的岗位被 AI 接管。24 小时，你选择证明不可替代，还是及时转身？",
    redAngle: "硬扛——证明有些价值 AI 给不了，这一仗认输就再无翻身。",
    blueAngle: "转身——与其困守旧岗位，不如趁早去 AI 够不到的地方重新落子。",
    tags: ["职场", "AI", "话题"],
  },
];

export function pickCase(seed?: number): CourtCaseSeed {
  const i =
    typeof seed === "number"
      ? Math.abs(Math.floor(seed)) % COURT_CASE_POOL.length
      : Math.floor(Math.random() * COURT_CASE_POOL.length);
  return COURT_CASE_POOL[i];
}

// 静态兜底庭审：当 AI 也不可用时，用一局手写庭审保证「永不空场」。
export const FALLBACK_CASE: CourtCase = {
  id: "fallback",
  caseTitle: "《不提分就出不去的房间》：走出房间那一刻，她该怎么选？",
  brief:
    "分数达标、锁死的门终于松动。面对回头示好的青梅竹马，和陪她死磕的冷面学霸，宋柠柠的结局该怎么写？本庭现开庭，请两造陈词。",
  source: "generated",
  red: {
    side: "red",
    headline: "谁都不选，先为自己而学",
    argument:
      "这间房教会她的从来不是爱情，而是“我能靠自己赢”。走出门的第一步若又扑向一个男生，前面所有的挣扎就成了笑话。让她把这份笃定留给自己——这才是对她成长最忠诚的写法。",
  },
  blue: {
    side: "blue",
    headline: "向李迟游挑明心意",
    argument:
      "陪她一晚晚啃题、把耐心藏在毒舌里的人，值得一个正面的回应。成长与心动并不矛盾——她已经足够独立，独立的人才有资格坦荡地说出喜欢。回避心意，反而是另一种不敢。",
  },
  rounds: [
    {
      red: "你把心动当成长的奖赏，可她要的是自己给自己发奖，不是等谁来兑现。",
      blue: "独立不等于孤身一人。她敢追分，为何不敢承认那晚清柠味里的心跳？",
    },
    {
      red: "刚学会为自己而活，转头就把结局系在别人身上，这叫倒退。",
      blue: "把喜欢说出口也是一种为自己而活——她在替过去那个只会追在人后的自己，赢一次。",
    },
    {
      red: "留白才有力量。不选，是把无限的可能留给她，而不是钉死一个 CP。",
      blue: "留白是逃避的漂亮说法。给她一个敢爱敢当的结局，才配得上她这一路的狠劲。",
    },
  ],
  verdictHint: "两造陈词已毕——你更认哪一种结局？投出你的一票。",
  createdAt: "1970-01-01T00:00:00.000Z",
};
