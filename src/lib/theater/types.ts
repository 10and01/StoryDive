// 「盐灵热榜剧场」领域类型：把一个热点话题变成一局 3-5 步多结局微 AVG。
// 剧场树由盐灵 Agent 生成为结构化 JSON，前端本地推进，不必每步调 AI。

// 一个选项：文案 + 指向下一步 id 或结局 id
export interface TheaterChoice {
  label: string; // 选项文案
  next: string; // 指向 step.id 或 ending.id
}

// 一步场景：一段旁白/情境 + 2-3 个抉择
export interface TheaterStep {
  id: string; // 唯一 id，如 "s1"
  narration: string; // 情境旁白（盐灵口吻）
  choices: TheaterChoice[];
}

// 一个结局：标题 + 收束正文 + 盐灵一句点评
export interface TheaterEnding {
  id: string; // 唯一 id，如 "e_good"
  title: string; // 结局卡标题
  body: string; // 结局正文
  verdict: string; // 盐灵点评/彩蛋一句话
  tone: "good" | "bad" | "twist" | "open"; // 结局基调（配色用）
}

// 一局完整剧场
export interface TheaterPlay {
  id: string; // 局 id
  topic: string; // 源话题
  source: "hotlist" | "generated"; // 实时热榜 or 盐灵自生成
  hook: string; // 盐灵开场钩子（一句话导语）
  role: string; // 读者在本局扮演的身份
  cover: string; // 水墨描金题图 URL
  dateLabel: string; // 「今日话题」日期标识，如 2026-09-07
  start: string; // 起始 step id
  steps: TheaterStep[];
  endings: TheaterEnding[];
  createdAt: string; // ISO
}

// 通用剧场题图：AI 现生成的局、或无专属图的话题，统一用这张水墨说书灯题图。
export const THEATER_COVER =
  "https://cdn.eazo.ai/user-contents/generated-images/59c42c66054242c1b4dcfd00fb865a55.png";

// 兜底热点话题池：当实时热榜接口不可用时，盐灵从这里取题自生成剧场。
// 覆盖职场/情感/校园/社会/脑洞等知乎高频语境，贴合盐言故事的题材气质。
export interface HotTopic {
  id: string;
  title: string; // 话题（拟知乎问题口吻）
  angle: string; // 盐灵切入的戏剧化角度，喂给 AI 定基调
  tags: string[];
  cover?: string; // 专属水墨题图 URL；缺省则用 THEATER_COVER
  url?: string; // 热榜原帖链接（来自知乎热榜 API）
}

const P = "https://cdn.eazo.ai/user-contents/generated-images";

export const HOT_TOPIC_POOL: HotTopic[] = [
  {
    id: "boss-first-day",
    title: "第一次当领导，是种什么体验？",
    angle: "空降管理者的第一天，老下属集体给你下马威，你要立威还是先稳住人心。",
    tags: ["职场", "管理", "新人"],
    cover: `${P}/2ea9a3874534472ca17c1d77b55b5fed.png`,
  },
  {
    id: "ai-replace",
    title: "如果你的工作明天就被 AI 取代，你会怎么办？",
    angle: "公司群里突然宣布你的岗位被 AI 接管，24 小时内你要为自己找到不可替代的价值。",
    tags: ["职场", "AI", "危机"],
    cover: `${P}/37e8f75300c6451ba0d749296010143e.png`,
  },
  {
    id: "reunion-lie",
    title: "同学聚会上，要不要拆穿一个善意的谎言？",
    angle: "多年未见的聚会上，你发现风光的老同学在撑一个体面的谎，全场只有你知道真相。",
    tags: ["情感", "人际", "选择"],
    cover: `${P}/ac006edb045148c8b291cec2ece7f5d9.png`,
  },
  {
    id: "landlord-secret",
    title: "租到一间便宜得离谱的房子，你会住吗？",
    angle: "房租低得反常，房东只有一个古怪规矩，入住第三天你听见了墙里的声音。",
    tags: ["悬疑", "都市", "脑洞"],
    cover: `${P}/0713d5b181a1454db780c8d718e5386b.png`,
  },
  {
    id: "wechat-wrong",
    title: "发错了一条微信，会引发怎样的连锁反应？",
    angle: "深夜你把一句心里话发错了群，撤回已经来不及，第二天所有人都在看你。",
    tags: ["社交", "都市", "尴尬"],
    cover: `${P}/ed6ca35b3d964919be2193316895de19.png`,
  },
  {
    id: "time-refund",
    title: "如果人生可以退款一次，你要退哪一段？",
    angle: "一个神秘客服找上你，说可以为你的人生办一次退款，但退掉的时间会永远消失。",
    tags: ["脑洞", "人生", "选择"],
  },
  {
    id: "exam-room",
    title: "高考前一晚，你会对当年的自己说什么？",
    angle: "你意外回到高考前夜的自习室，遇见了那个焦虑到失眠的自己。",
    tags: ["校园", "青春", "成长"],
    cover: `${P}/83be70a713e6498f926397d287862ab8.png`,
  },
  {
    id: "startup-crash",
    title: "创业公司要黄了，作为核心员工你会走还是留？",
    angle: "发不出工资的第三个月，老板画了最后一张饼，同事们连夜在收拾工位。",
    tags: ["职场", "创业", "抉择"],
  },
  {
    id: "family-group",
    title: "家庭群里长辈转发的谣言，你会戳穿吗？",
    angle: "家族群里妈妈转了一条养生谣言，全家附和，只有你知道那是假的。",
    tags: ["家庭", "代际", "沟通"],
  },
  {
    id: "old-friend-borrow",
    title: "多年不联系的朋友突然找你借钱，你会借吗？",
    angle: "凌晨的一条消息，是十年没联系的老友，开口就是一个让你为难的数字。",
    tags: ["情感", "金钱", "人际"],
  },
];

export function pickTopic(seed?: number): HotTopic {
  const i =
    typeof seed === "number"
      ? Math.abs(Math.floor(seed)) % HOT_TOPIC_POOL.length
      : Math.floor(Math.random() * HOT_TOPIC_POOL.length);
  return HOT_TOPIC_POOL[i];
}

// 「今日话题」：以当天日期为种子确定性选题——同一天进来永远是同一题，
// 隔天自动轮换到下一题，让「每天在长」看得见、且可复现。
export function todayTopic(now = new Date()): { topic: HotTopic; dateLabel: string } {
  const dateLabel = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  return { topic: pickTopic(dayNumber), dateLabel };
}

// 兜底剧场：当 AI 也不可用时，用一局手写的静态剧场保证「永不空场」。
export const FALLBACK_PLAY: TheaterPlay = {
  id: "fallback",
  topic: "第一次当领导，是种什么体验？",
  source: "generated",
  hook: "空降的第一天，办公室的空气比空调还冷——老下属们都在等着看你的笑话。",
  role: "空降的新任主管",
  cover: `${P}/2ea9a3874534472ca17c1d77b55b5fed.png`,
  dateLabel: "",
  start: "s1",
  steps: [
    {
      id: "s1",
      narration:
        "你推门进会议室，六双眼睛齐刷刷看过来，没人起身。资历最老的老周慢悠悠开口：「新领导，先说说你的方案吧？」——他分明知道你还没摸清情况。",
      choices: [
        { label: "坦白还没熟悉，先请大家介绍手头的活", next: "s2" },
        { label: "硬着头皮画一张大饼镇住场子", next: "e_bluff" },
        { label: "反问老周：那你觉得该怎么做？", next: "s2" },
      ],
    },
    {
      id: "s2",
      narration:
        "一圈聊下来，你发现真正的问题不在能力，而在人心：老周带着大家在观望你到底靠不靠谱。散会后，老周单独留下来，递给你一支烟。",
      choices: [
        { label: "接过烟，跟他掏心窝子聊聊", next: "e_win" },
        { label: "婉拒，公事公办地谈工作", next: "e_stiff" },
      ],
    },
  ],
  endings: [
    {
      id: "e_win",
      title: "人心是暖的",
      body:
        "你没端架子，跟老周聊起彼此的难处。他叹口气：「行，冲你这句实话，这活我们接了。」第二天，团队第一次主动把进度表发到了你桌上。",
      verdict: "盐灵：立威不如立信——你赢的不是这场会，是往后每一天。",
      tone: "good",
    },
    {
      id: "e_stiff",
      title: "公事公办的墙",
      body:
        "你守住了分寸，也守住了距离。活能推下去，只是每次都得你亲自盯着。团队很客气，客气得像隔着一层玻璃。",
      verdict: "盐灵：没有错，只是少了点让人愿意多走一步的东西。",
      tone: "open",
    },
    {
      id: "e_bluff",
      title: "饼碎了一地",
      body:
        "你画的饼太大，落地时摔得粉碎。老周在群里不咸不淡地@你：「主管，上次说的那个方案……」全组的目光又一次落在你身上。",
      verdict: "盐灵：新官上任最烫的不是三把火，是自己吹出去的牛。",
      tone: "bad",
    },
  ],
  createdAt: "1970-01-01T00:00:00.000Z",
};
