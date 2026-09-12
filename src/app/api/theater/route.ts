import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/ai-client";
import { theaterSystemPrompt, theaterUserPrompt } from "@/lib/theater/prompts";
import { fetchHotTopic } from "@/lib/theater/hotlist";
import {
  todayTopic,
  FALLBACK_PLAY,
  THEATER_COVER,
  type TheaterPlay,
  type TheaterStep,
  type TheaterEnding,
} from "@/lib/theater/types";

// 从 AI 回复里抽出 JSON（容错 markdown 围栏 / 前后杂字）
function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// 校验并规整成 TheaterPlay：steps/endings 合法、无悬空引用、start 有效。
function toPlay(
  obj: unknown,
  topic: { title: string; cover?: string },
  source: TheaterPlay["source"],
  dateLabel: string,
): TheaterPlay | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const endingsRaw = Array.isArray(o.endings) ? o.endings : [];
  if (stepsRaw.length < 1 || endingsRaw.length < 2) return null;

  const steps: TheaterStep[] = [];
  for (const s of stepsRaw) {
    const so = s as Record<string, unknown>;
    const choices = Array.isArray(so.choices) ? so.choices : [];
    const okChoices = choices
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.label === "string" && typeof c.next === "string")
      .map((c) => ({ label: c.label as string, next: c.next as string }));
    if (typeof so.id !== "string" || typeof so.narration !== "string" || okChoices.length < 2)
      return null;
    steps.push({ id: so.id, narration: so.narration, choices: okChoices });
  }

  const endings: TheaterEnding[] = [];
  const tones = new Set(["good", "bad", "twist", "open"]);
  for (const e of endingsRaw) {
    const eo = e as Record<string, unknown>;
    if (
      typeof eo.id !== "string" ||
      typeof eo.title !== "string" ||
      typeof eo.body !== "string"
    )
      return null;
    endings.push({
      id: eo.id,
      title: eo.title,
      body: eo.body,
      verdict: typeof eo.verdict === "string" ? eo.verdict : "",
      tone: tones.has(eo.tone as string) ? (eo.tone as TheaterEnding["tone"]) : "open",
    });
  }

  // 引用完整性：每个 choice.next 必须指向已存在的 step 或 ending
  const ids = new Set<string>([...steps.map((s) => s.id), ...endings.map((e) => e.id)]);
  for (const s of steps) {
    for (const c of s.choices) if (!ids.has(c.next)) return null;
  }
  const start = typeof o.start === "string" && steps.some((s) => s.id === o.start)
    ? (o.start as string)
    : steps[0].id;

  return {
    id: `tp-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    topic: topic.title,
    source,
    hook: typeof o.hook === "string" ? o.hook : topic.title,
    role: typeof o.role === "string" ? o.role : "故事里的你",
    cover: topic.cover ?? THEATER_COVER,
    dateLabel,
    start,
    steps,
    endings,
    createdAt: new Date().toISOString(),
  };
}

// GET /api/theater  生成今日/一局盐灵剧场（登录必需，与全站一致）。
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // 1) 优先实时热榜；拿不到则用「今日话题」（按天确定性轮换，永不空场的第一层兜底）
  const hot = await fetchHotTopic();
  const daily = todayTopic();
  const topic = hot ?? daily.topic;
  const dateLabel = daily.dateLabel;
  const source: TheaterPlay["source"] = hot ? "hotlist" : "generated";

  // 2) 调 App AI 生成结构化剧场
  try {
    const result = await appAi.chat({
      messages: [
        { role: "system", content: theaterSystemPrompt() },
        { role: "user", content: theaterUserPrompt(topic) },
      ],
      params: { viewer_user_id: auth.user.id, temperature: 0.95 },
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
