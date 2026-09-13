// 知乎直答 API：OpenAI Chat Completions 兼容端点（POST /v1/chat/completions）。
// 文档只正式保证 model/messages/stream 三个字段；非流式取 choices[0].message.content。
// system role 的支持未在文档中明确：若请求失败，把 system 合并进首条 user 消息重试一次。

import { zhihuHeaders } from "./client";
import { AppAIUnavailableError } from "@/lib/ai-client";

const ZHIDA_ENDPOINT = "https://developer.zhihu.com/v1/chat/completions";

export type ZhidaModel = "zhida-fast-1p5" | "zhida-thinking-1p5";

export interface ZhidaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function post(model: ZhidaModel, messages: ZhidaMessage[]): Promise<Response> {
  const headers = zhihuHeaders();
  if (!headers) throw new AppAIUnavailableError();
  try {
    return await fetch(ZHIDA_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream: false }),
      cache: "no-store",
    });
  } catch {
    throw new AppAIUnavailableError();
  }
}

// 直答回答。未配置密钥、额度耗尽或服务异常时抛 AppAIUnavailableError，由调用方降级。
export async function zhidaChat(
  messages: ZhidaMessage[],
  model: ZhidaModel = "zhida-fast-1p5",
): Promise<string> {
  let res = await post(model, messages);
  if (!res.ok && messages[0]?.role === "system") {
    const [system, ...rest] = messages;
    const firstUser = rest.findIndex((m) => m.role === "user");
    const merged = rest.map((m, i) =>
      i === firstUser
        ? { role: "user" as const, content: `${system.content}\n\n${m.content}` }
        : m,
    );
    res = await post(model, merged);
  }
  if (!res.ok) throw new AppAIUnavailableError();
  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new AppAIUnavailableError();
  return content;
}
