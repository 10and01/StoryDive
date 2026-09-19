import OpenAI from "openai";
import { decryptApiKey } from "./crypto";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (clean === "::" || clean === "::1" || clean.startsWith("fe80:") || clean.startsWith("fc") || clean.startsWith("fd")) {
    return true;
  }
  if (clean.startsWith("::ffff:")) {
    const tail = clean.slice("::ffff:".length);
    if (isBlockedIpv4(tail)) return true;
    const groups = tail.split(":");
    if (groups.length === 2 && groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
      const first = Number.parseInt(groups[0], 16);
      const second = Number.parseInt(groups[1], 16);
      const address = `${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`;
      return isBlockedIpv4(address);
    }
  }
  return false;
}

export function validateProviderBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Base URL 不是有效网址");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new Error("Base URL 必须使用 HTTPS");
  if (url.username || url.password) throw new Error("Base URL 不能包含登录凭据");
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isBlockedIpv6(hostname) ||
    isBlockedIpv4(hostname)
  ) {
    throw new Error("Base URL 不能指向本机、私网或云元数据地址");
  }
  // Literal private addresses are blocked above. A provider hostname can still
  // resolve to a private address after this validation, so the deployment
  // should also route these requests through an egress policy that blocks
  // private/link-local ranges after DNS resolution.
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

async function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requested = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  validateProviderBaseUrl(`${requested.protocol}//${requested.host}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(input, { ...init, redirect: "error", signal: controller.signal });
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > 2 * 1024 * 1024) throw new Error("模型响应超过 2 MiB 限制");
    if (!response.body) return response;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("模型响应超过 2 MiB 限制");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export interface ProviderSecretSnapshot {
  baseUrl: string;
  model: string;
  encryptedApiKey: string;
}

export async function createProviderClient(snapshot: ProviderSecretSnapshot): Promise<OpenAI> {
  return new OpenAI({
    apiKey: await decryptApiKey(snapshot.encryptedApiKey),
    baseURL: validateProviderBaseUrl(snapshot.baseUrl),
    fetch: guardedFetch as unknown as typeof fetch,
    maxRetries: 0,
  });
}

export async function testProviderConnection(snapshot: ProviderSecretSnapshot): Promise<void> {
  const client = await createProviderClient(snapshot);
  await client.chat.completions.create({
    model: snapshot.model,
    messages: [{ role: "user", content: "Reply with OK." }],
    max_tokens: 4,
    temperature: 0,
  });
}
