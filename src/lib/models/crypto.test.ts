import assert from "node:assert/strict";
import test from "node:test";
import { decryptApiKey, encryptApiKey, maskApiKey } from "./crypto";

test("API keys round-trip through AES-GCM and remain masked", async () => {
  process.env.MODEL_PROVIDER_ENCRYPTION_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
  const original = "sk-test-abcdefghijklmnopqrstuvwxyz";
  const encrypted = await encryptApiKey(original);
  assert.notEqual(encrypted, original);
  assert.equal(await decryptApiKey(encrypted), original);
  assert.equal(maskApiKey(original), "sk-••••••wxyz");
});

test("tampered ciphertext cannot be decrypted", async () => {
  process.env.MODEL_PROVIDER_ENCRYPTION_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
  const encrypted = await encryptApiKey("sk-secret-value");
  const [version, iv, payload] = encrypted.split(".");
  const first = payload[0] === "A" ? "B" : "A";
  await assert.rejects(() => decryptApiKey(`${version}.${iv}.${first}${payload.slice(1)}`));
});
