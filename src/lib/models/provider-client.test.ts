import assert from "node:assert/strict";
import test from "node:test";
import { validateProviderBaseUrl } from "./provider-client";

test("accepts public HTTPS OpenAI-compatible endpoints", () => {
  assert.equal(validateProviderBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
});

for (const blocked of [
  "http://api.example.com/v1",
  "https://localhost/v1",
  "https://127.0.0.1/v1",
  "https://10.0.0.4/v1",
  "https://169.254.169.254/latest/meta-data",
  "https://metadata.google.internal/v1",
  "https://[::1]/v1",
  "https://[::ffff:127.0.0.1]/v1",
  "https://[::ffff:7f00:1]/v1",
]) {
  test(`blocks unsafe endpoint ${blocked}`, () => {
    assert.throws(() => validateProviderBaseUrl(blocked));
  });
}
