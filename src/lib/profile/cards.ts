// 判例卡读取：用户自己授权同步的知乎回答（标题+摘要+赞同数+链接）。
// 「知乎灵魂」（对戏）与「法庭判例」（盐官判词/想法文案）的共用素材来源。
// 未授权 / 未同步 / 数据损坏都返回 []，调用方按无判例降级。

import { getUserProfileRow } from "@/lib/db/queries/profile";
import type { UserContentCard } from "./types";

export async function loadConsentedCards(userId: string): Promise<UserContentCard[]> {
  try {
    const row = await getUserProfileRow(userId);
    if (!row?.consentContents || !row.contentsJson) return [];
    const cards = JSON.parse(row.contentsJson) as UserContentCard[];
    return Array.isArray(cards) ? cards.slice(0, 5) : [];
  } catch {
    return [];
  }
}

// 判例块：注入盐官判词 / 想法文案的紧凑文本。
export function cardsBlock(cards: UserContentCard[]): string {
  if (cards.length === 0) return "";
  const lines = cards.map(
    (c) => `- 《${c.title}》（赞同 ${c.likeCount}）${c.summary ? `：${c.summary.slice(0, 60)}` : ""}`,
  );
  return `【这位观众自己的知乎回答（TA 授权引用）】\n${lines.join("\n")}`;
}
