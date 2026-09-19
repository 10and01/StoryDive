const KEY_BYTES = 32;
const IV_BYTES = 12;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(): Promise<CryptoKey> {
  const configured = process.env.MODEL_PROVIDER_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("MODEL_PROVIDER_ENCRYPTION_KEY is not configured");
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64Url(configured);
  } catch {
    throw new Error("MODEL_PROVIDER_ENCRYPTION_KEY must be base64url encoded");
  }
  if (raw.byteLength !== KEY_BYTES) {
    throw new Error("MODEL_PROVIDER_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(apiKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(apiKey),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  const [version, iv, encrypted] = ciphertext.split(".");
  if (version !== "v1" || !iv || !encrypted) throw new Error("Unsupported API key ciphertext");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await encryptionKey(),
    fromBase64Url(encrypted),
  );
  return new TextDecoder().decode(plain);
}

export function maskApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 8) return "••••••••";
  return `${clean.slice(0, 3)}••••••${clean.slice(-4)}`;
}
