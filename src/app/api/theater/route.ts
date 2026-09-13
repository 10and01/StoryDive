import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/ai-client";
import { theaterSystemPrompt, theaterUserPrompt } from "@/lib/theater/prompts";
import { getUserProfileRow } from "@/lib/db/queries/profile";
import type { UserProfile } from "@/lib/profile/types";
import { fetchHotTopic } from "@/lib/theater/hotlist";
import { extractJson, toPlay } from "@/lib/theater/parse";
import {
  todayTopic,
  FALLBACK_PLAY,
  THEATER_COVER,
  type TheaterPlay,
} from "@/lib/theater/types";

// GET /api/theater  生成今日/一局盐灵剧场（登录必需，与全站一致）。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { real: true });
  if (!auth.ok) return auth.response;

  // 1) 优先实时热榜；拿不到则用「今日话题」（按天确定性轮换，永不空场的第一层兜底）
  const hot = await fetchHotTopic();
  const daily = todayTopic();
  const topic = hot ?? daily.topic;
  const dateLabel = daily.dateLabel;
  const source: TheaterPlay["source"] = hot ? "hotlist" : "generated";

  // 观众画像（知乎创作提炼）：题材与角色设定贴着兴趣来（增强项，读不到就用原话题）
  let audienceHint = "";
  try {
    const row = await getUserProfileRow(auth.user.id);
    if (row?.profileJson) {
      const p = JSON.parse(row.profileJson) as UserProfile;
      if (p.keywords?.length) {
        audienceHint = `旁听席画像：这位读者平时关注 ${p.keywords.join("、")}——题材与角色设定可以贴着这些兴趣来。`;
      }
    }
  } catch {
    // 画像读取失败不拦剧场
  }

  // 2) 调 App AI 生成结构化剧场
  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: theaterSystemPrompt() },
        { role: "user", content: [theaterUserPrompt(topic), audienceHint].filter(Boolean).join("\n\n") },
      ],
      viewer_user_id: auth.user.id,
      temperature: 0.95,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    const play = toPlay(extractJson(text), topic, source, dateLabel);
    if (play) return Response.json({ play });
    // 3) 解析失败 → 静态兜底剧场
    return Response.json({
      play: { ...FALLBACK_PLAY, topic: topic.title, cover: topic.cover ?? THEATER_COVER, dateLabel },
    });
  } catch (error) {
    // AI 不可用 → 静态兜底剧场（依旧可玩，Demo 不空场）
    if (error instanceof AppAIUnavailableError) {
      return Response.json({
        play: { ...FALLBACK_PLAY, topic: topic.title, cover: topic.cover ?? THEATER_COVER, dateLabel },
      });
    }
    throw error;
  }
}
