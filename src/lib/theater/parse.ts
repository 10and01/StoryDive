// 剧场结构化输出解析：AI JSON → 校验规整的 TheaterPlay。
// 从 /api/theater 路由抽出共享（热榜剧场与知识库定制剧场共用同一套校验）。

import {
  THEATER_COVER,
  type TheaterEnding,
  type TheaterPlay,
  type TheaterStep,
} from "./types";

// 从 AI 回复里抽出 JSON（容错 markdown 围栏 / 前后杂字）
export function extractJson(text: string): unknown | null {
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
export function toPlay(
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
