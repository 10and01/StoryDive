// 签名会话：HttpOnly Cookie 携带 base64url(payload).hmac。
// 用 Web Crypto 实现，Node 与 Cloudflare Workers（workerd）通用。

export const SESSION_COOKIE = "rv_session";
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 3600; // 180 天

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface SessionPayload extends SessionUser {
  /** 知乎 OAuth access_token（登录用户才有，供服务端代表用户调用户数据 API） */
  oauthToken?: string;
  /** 游客会话标记 */
  guest?: boolean;
  exp: number; // Unix 秒
}

function secret(): string {
  // 生产必须配置 SESSION_SECRET；开发环境退默认值保证开箱即用。
  return process.env.SESSION_SECRET || "ruju-dev-insecure-secret";
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
  const bin = atob(b64 + "=".repeat(pad));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(sig),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (!payload.id) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readSessionCookie(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return undefined;
}

export function sessionCookieParams(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

const GUEST_NAME_POOL = ["拾荒者", "说书人", "拆局人", "看客", "入局者", "执棋人", "过客", "巡夜人"];

export function makeGuestPayload(): SessionPayload {
  const rand = crypto.randomUUID().replace(/-/g, "");
  return {
    id: `guest-${rand.slice(0, 16)}`,
    name: `${GUEST_NAME_POOL[Math.floor(Math.random() * GUEST_NAME_POOL.length)]}${rand.slice(0, 4)}`,
    guest: true,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
}
