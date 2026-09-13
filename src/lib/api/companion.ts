// 刘看山伴读对话的客户端封装：回复 + 可渲染成 chip 的真实回答引用。

import { request } from "./request";
import type { ZhihuCitation } from "./zhihu-citation";

export interface CompanionTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askCompanion(input: {
  storyId: string;
  paragraph: number;
  message: string;
  history: CompanionTurn[];
}): Promise<{ reply: string; citations: ZhihuCitation[]; source: "zhida" | "app" }> {
  const res = await request("/api/companion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    reply?: string;
    citations?: ZhihuCitation[];
    source?: "zhida" | "app";
  };
  return {
    reply: data.reply ?? "",
    citations: data.citations ?? [],
    source: data.source ?? "app",
  };
}
