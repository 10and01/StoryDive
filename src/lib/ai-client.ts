import OpenAI from "openai";

// OpenAI 兼容协议客户端：一个 SDK 入口访问各厂商模型。
// 默认指向 api.openai-next.com + DeepSeek v4 flash，均可用环境变量覆盖。
type ChatMessage = {
  role: string;
  content: unknown;
  [key: string]: unknown;
};

type ChatParams = {
  model?: string;
  model_key?: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
};

type StreamingChatParams = ChatParams & {
  stream: true;
};

type ChatCompletionLike = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ChatDeltaChunk = {
  choices: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

// 前端（app-ai-request.ts）依赖这个 402 + code 的错误约定做统一 toast。
export class AppAIUnavailableError extends Error {
  code = "app_ai_unavailable";

  constructor(message = APP_AI_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "AppAIUnavailableError";
  }
}

export const APP_AI_UNAVAILABLE_MESSAGE =
  "AI 功能暂时不可用，请稍后再试。";

const DEFAULT_BASE_URL = "https://api.openai-next.com/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppAIUnavailableError();
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey,
      baseURL: (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    });
  }
  return cachedClient;
}

function modelName(params: ChatParams) {
  return (
    String(params.model || params.model_key || process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() ||
    DEFAULT_MODEL
  );
}

// params 里混着业务自定义字段（viewer_user_id 等），只透传 OpenAI 认识的采样参数。
function samplingParams(params: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of ["temperature", "top_p", "max_tokens", "presence_penalty", "frequency_penalty"] as const) {
    if (params[key] !== undefined) out[key] = params[key];
  }
  return out;
}

function toOpenAiMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (m.role === "system") return { role: "system" as const, content: text };
    if (m.role === "assistant") return { role: "assistant" as const, content: text };
    return { role: "user" as const, content: text };
  });
}

function mapError(error: unknown): never {
  if (error instanceof AppAIUnavailableError) throw error;
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    // 401/403 key 无效、402/429 额度问题、5xx 服务端异常，对 UI 都表现为“AI 暂不可用”
    if (status === 401 || status === 402 || status === 403 || status === 429 || status >= 500) {
      throw new AppAIUnavailableError();
    }
    throw new Error(error.message || `AI request failed (${status})`);
  }
  throw error instanceof Error ? error : new Error(String(error));
}

function isAsyncIterable<T>(x: unknown): x is AsyncIterable<T> {
  return (
    typeof x === "object" && x !== null && Symbol.asyncIterator in x
  );
}

async function* adaptStream(
  stream: unknown,
): AsyncGenerator<ChatDeltaChunk> {
  if (!isAsyncIterable<ChatDeltaChunk>(stream)) return;
  for await (const chunk of stream) {
    yield chunk;
  }
}

async function chat(params: StreamingChatParams): Promise<AsyncIterable<ChatDeltaChunk>>;
async function chat(params: ChatParams): Promise<ChatCompletionLike>;
async function chat(
  params: ChatParams,
): Promise<ChatCompletionLike | AsyncIterable<ChatDeltaChunk>> {
  const { messages, ...rest } = params;
  const client = getClient();
  const createArgs = {
    model: modelName(params),
    messages: toOpenAiMessages(messages),
    ...samplingParams(rest),
  };
  try {
    if (params.stream === true) {
      const stream = await client.chat.completions.create({ ...createArgs, stream: true });
      return adaptStream(stream);
    }
    const completion = await client.chat.completions.create({
      ...createArgs,
      stream: false,
    });
    return completion as ChatCompletionLike;
  } catch (error) {
    mapError(error);
  }
}

export const appAi = { chat };
