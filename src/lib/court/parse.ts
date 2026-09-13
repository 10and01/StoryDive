import type { CourtClaim, Side } from "./types";

// 从 LLM 文本里抠 JSON 对象（兼容 ```json 围栏与前后杂讯）。
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

// 校验成 CourtClaim（庭辩 Agent 的立论输出）。
export function extractClaim(text: string, side: Side): CourtClaim | null {
  const o = extractJson(text);
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  if (typeof c.headline !== "string" || typeof c.argument !== "string") return null;
  return { side, headline: c.headline.trim(), argument: c.argument.trim() };
}
